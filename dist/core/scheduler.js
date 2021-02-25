"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
const events_1 = require("events");
const os = __importStar(require("os"));
const queue_1 = require("./queue");
const redlock_leader_1 = __importDefault(require("redlock-leader"));
class Scheduler extends events_1.EventEmitter {
    constructor(options, jobs = {}) {
        super();
        const defaults = {
            timeout: 5000,
            stuckWorkerTimeout: 60 * 60 * 1000,
            leaderLockTimeout: 60 * 3,
            name: os.hostname() + ":" + process.pid,
            retryStuckJobs: false,
        };
        for (const i in defaults) {
            if (options[i] === null || options[i] === undefined) {
                options[i] = defaults[i];
            }
        }
        this.options = options;
        this.name = this.options.name;
        this.leader = false;
        this.running = false;
        this.processing = false;
        this.queue = new queue_1.Queue({ connection: options.connection }, jobs);
        this.queue.on("error", (error) => {
            this.emit("error", error);
        });
    }
    async connect() {
        await this.queue.connect();
        this.connection = this.queue.connection;
        this.redlock = new redlock_leader_1.default([this.connection.redis], {
            key: this.connection.key("leader")
        });
        this.redlock.on("error", (error) => {
            this.emit("error", error);
        });
    }
    async start() {
        this.processing = false;
        if (!this.running) {
            await this.redlock.start();
            this.emit("start");
            this.running = true;
            this.pollAgainLater();
        }
    }
    async end() {
        this.running = false;
        clearTimeout(this.timer);
        if (this.processing === false) {
            if (this.connection &&
                (this.connection.connected === true ||
                    this.connection.connected === undefined ||
                    this.connection.connected === null)) {
                try {
                    await this.redlock.stop();
                }
                catch (error) {
                    this.emit("error", error);
                }
            }
            try {
                await this.queue.end();
                this.emit("end");
            }
            catch (error) {
                this.emit("error", error);
            }
        }
        else {
            return new Promise((resolve) => {
                setTimeout(async () => {
                    await this.end();
                    resolve(null);
                }, this.options.timeout / 2);
            });
        }
    }
    async poll() {
        this.processing = true;
        clearTimeout(this.timer);
        const isLeader = this.redlock.isLeader;
        if (!isLeader) {
            this.leader = false;
            this.processing = false;
            return this.pollAgainLater();
        }
        if (!this.leader) {
            this.leader = true;
            this.emit("leader");
        }
        this.emit("poll");
        const timestamp = await this.nextDelayedTimestamp();
        if (timestamp) {
            this.emit("workingTimestamp", timestamp);
            try {
                await this.enqueueDelayedItemsForTimestamp(parseInt(timestamp));
            }
            catch (error) {
                this.emit("error", error);
            }
            return this.poll();
        }
        else {
            try {
                await this.checkStuckWorkers();
            }
            catch (error) {
                this.emit("error", error);
            }
            this.processing = false;
            return this.pollAgainLater();
        }
    }
    async pollAgainLater() {
        if (this.running === true) {
            this.timer = setTimeout(() => {
                this.poll();
            }, this.options.timeout);
        }
    }
    async nextDelayedTimestamp() {
        const time = Math.round(new Date().getTime() / 1000);
        const items = await this.connection.redis.zrangebyscore(this.connection.key("delayed_queue_schedule"), 0, time, "LIMIT", 0, 1);
        if (items.length === 0) {
            return;
        }
        return items[0];
    }
    async enqueueDelayedItemsForTimestamp(timestamp) {
        const job = await this.nextItemForTimestamp(timestamp);
        if (job) {
            await this.transfer(timestamp, job);
            await this.enqueueDelayedItemsForTimestamp(timestamp);
        }
        else {
            await this.cleanupTimestamp(timestamp);
        }
    }
    async nextItemForTimestamp(timestamp) {
        const key = this.connection.key("delayed:" + timestamp);
        const job = await this.connection.redis.lpop(key);
        await this.connection.redis.srem(this.connection.key("timestamps:" + job), "delayed:" + timestamp);
        return JSON.parse(job);
    }
    async transfer(timestamp, job) {
        await this.queue.enqueue(job.queue, job.class, job.args);
        this.emit("transferredJob", timestamp, job);
    }
    async cleanupTimestamp(timestamp) {
        const key = this.connection.key("delayed:" + timestamp);
        await this.watchIfPossible(key);
        await this.watchIfPossible(this.connection.key("delayed_queue_schedule"));
        const length = await this.connection.redis.llen(key);
        if (length === 0) {
            await this.connection.redis
                .multi()
                .del(key)
                .zrem(this.connection.key("delayed_queue_schedule"), timestamp)
                .exec();
        }
        await this.unwatchIfPossible();
    }
    async checkStuckWorkers() {
        if (!this.options.stuckWorkerTimeout) {
            return;
        }
        const keys = await this.connection.getKeys(this.connection.key("worker", "ping", "*"));
        const payloads = await Promise.all(keys.map(async (k) => {
            return JSON.parse(await this.connection.redis.get(k));
        }));
        const nowInSeconds = Math.round(new Date().getTime() / 1000);
        const stuckWorkerTimeoutInSeconds = Math.round(this.options.stuckWorkerTimeout / 1000);
        for (let i in payloads) {
            if (!payloads[i])
                continue;
            const { name, time } = payloads[i];
            const delta = nowInSeconds - time;
            if (delta > stuckWorkerTimeoutInSeconds) {
                await this.forceCleanWorker(name, delta);
            }
        }
        if (this.options.retryStuckJobs === true) {
            await this.queue.retryStuckJobs();
        }
    }
    async forceCleanWorker(workerName, delta) {
        const errorPayload = await this.queue.forceCleanWorker(workerName);
        this.emit("cleanStuckWorker", workerName, errorPayload, delta);
    }
    async watchIfPossible(key) {
        if (typeof this.connection.redis.watch === "function") {
            return this.connection.redis.watch(key);
        }
    }
    async unwatchIfPossible() {
        if (typeof this.connection.redis.unwatch === "function") {
            return this.connection.redis.unwatch();
        }
    }
}
exports.Scheduler = Scheduler;
