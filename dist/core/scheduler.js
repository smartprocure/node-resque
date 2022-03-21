"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
        var _a, _b, _c, _d, _e;
        super();
        options.timeout = (_a = options.timeout) !== null && _a !== void 0 ? _a : 5000; // in ms
        options.stuckWorkerTimeout = (_b = options.stuckWorkerTimeout) !== null && _b !== void 0 ? _b : 60 * 60 * 1000; // 60 minutes in ms
        options.leaderLockTimeout = (_c = options.leaderLockTimeout) !== null && _c !== void 0 ? _c : 60 * 3; // in seconds
        options.name = (_d = options.name) !== null && _d !== void 0 ? _d : os.hostname() + ":" + process.pid; // assumes only one worker per node process
        options.retryStuckJobs = (_e = options.retryStuckJobs) !== null && _e !== void 0 ? _e : false;
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
            key: this.connection.key("leader"),
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
    async tryForLeader() {
        const leaderKey = this.queue.leaderKey();
        if (!this.connection || !this.connection.redis) {
            return;
        }
        const lockedByMe = await this.connection.redis.set(leaderKey, this.options.name, "NX", "EX", this.options.leaderLockTimeout);
        if (lockedByMe && lockedByMe.toLowerCase() === "ok") {
            return true;
        }
        const currentLeaderName = await this.connection.redis.get(leaderKey);
        if (currentLeaderName === this.options.name) {
            await this.connection.redis.expire(leaderKey, this.options.leaderLockTimeout);
            return true;
        }
        return false;
    }
    async releaseLeaderLock() {
        if (!this.connection || !this.connection.redis) {
            return;
        }
        const isLeader = await this.tryForLeader();
        if (!isLeader) {
            return false;
        }
        const deleted = await this.connection.redis.del(this.queue.leaderKey());
        this.leader = false;
        return deleted === 1 || deleted.toString() === "true";
    }
    async nextDelayedTimestamp() {
        const time = Math.round(new Date().getTime() / 1000);
        const items = await this.connection.redis.zrangebyscore(this.connection.key("delayed_queue_schedule"), 0, time, "LIMIT", 0, 1);
        if (items.length === 0)
            return;
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
        if (this.canWatch())
            return this.connection.redis.watch(key);
    }
    async unwatchIfPossible() {
        if (this.canWatch())
            return this.connection.redis.unwatch();
    }
    canWatch() {
        var _a, _b;
        if (((_b = (_a = this.connection.redis) === null || _a === void 0 ? void 0 : _a.constructor) === null || _b === void 0 ? void 0 : _b.name) === "RedisMock")
            return false;
        if (typeof this.connection.redis.unwatch !== "function")
            return false;
        return true;
    }
}
exports.Scheduler = Scheduler;
