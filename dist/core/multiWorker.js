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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiWorker = void 0;
const events_1 = require("events");
const os = __importStar(require("os"));
const worker_1 = require("./worker");
const eventLoopDelay_1 = require("../utils/eventLoopDelay");
class MultiWorker extends events_1.EventEmitter {
    constructor(options, jobs) {
        var _a, _b, _c, _d, _e, _f;
        super();
        options.name = (_a = options.name) !== null && _a !== void 0 ? _a : os.hostname();
        options.minTaskProcessors = (_b = options.minTaskProcessors) !== null && _b !== void 0 ? _b : 1;
        options.maxTaskProcessors = (_c = options.maxTaskProcessors) !== null && _c !== void 0 ? _c : 10;
        options.timeout = (_d = options.timeout) !== null && _d !== void 0 ? _d : 5000;
        options.checkTimeout = (_e = options.checkTimeout) !== null && _e !== void 0 ? _e : 500;
        options.maxEventLoopDelay = (_f = options.maxEventLoopDelay) !== null && _f !== void 0 ? _f : 10;
        if (options.connection.redis &&
            typeof options.connection.redis.setMaxListeners === "function") {
            options.connection.redis.setMaxListeners(options.connection.redis.getMaxListeners() + options.maxTaskProcessors);
        }
        this.workers = [];
        this.options = options;
        this.jobs = jobs;
        this.running = false;
        this.working = false;
        this.name = this.options.name;
        this.eventLoopBlocked = true;
        this.eventLoopDelay = Infinity;
        this.eventLoopCheckCounter = 0;
        this.stopInProcess = false;
        this.checkTimer = null;
        this.PollEventLoopDelay();
    }
    PollEventLoopDelay() {
        (0, eventLoopDelay_1.EventLoopDelay)(this.options.maxEventLoopDelay, this.options.checkTimeout, (blocked, ms) => {
            this.eventLoopBlocked = blocked;
            this.eventLoopDelay = ms;
            this.eventLoopCheckCounter++;
        });
    }
    async startWorker() {
        const id = this.workers.length + 1;
        const worker = new worker_1.Worker({
            connection: this.options.connection,
            queues: this.options.queues,
            timeout: this.options.timeout,
            name: this.options.name + ":" + process.pid + "+" + id,
        }, this.jobs);
        worker.id = id;
        worker.on("start", () => {
            this.emit("start", worker.id);
        });
        worker.on("end", () => {
            this.emit("end", worker.id);
        });
        worker.on("cleaning_worker", (worker, pid) => {
            this.emit("cleaning_worker", worker.id, worker, pid);
        });
        worker.on("poll", (queue) => {
            this.emit("poll", worker.id, queue);
        });
        worker.on("ping", (time) => {
            this.emit("ping", worker.id, time);
        });
        worker.on("job", (queue, job) => {
            this.emit("job", worker.id, queue, job);
        });
        worker.on("reEnqueue", (queue, job, plugin) => {
            this.emit("reEnqueue", worker.id, queue, job, plugin);
        });
        worker.on("success", (queue, job, result, duration) => {
            this.emit("success", worker.id, queue, job, result, duration);
        });
        worker.on("failure", (queue, job, failure, duration) => {
            this.emit("failure", worker.id, queue, job, failure, duration);
        });
        worker.on("error", (error, queue, job) => {
            this.emit("error", error, worker.id, queue, job);
        });
        worker.on("pause", () => {
            this.emit("pause", worker.id);
        });
        this.workers.push(worker);
        await worker.connect();
        await worker.start();
    }
    async checkWorkers() {
        let verb;
        let worker;
        let workingCount = 0;
        this.workers.forEach((worker) => {
            if (worker.working === true) {
                workingCount++;
            }
        });
        this.working = workingCount > 0;
        if (this.running === false && this.workers.length > 0) {
            verb = "--";
        }
        else if (this.running === false && this.workers.length === 0) {
            verb = "x";
        }
        else if (this.eventLoopBlocked &&
            this.workers.length > this.options.minTaskProcessors) {
            verb = "-";
        }
        else if (this.eventLoopBlocked &&
            this.workers.length === this.options.minTaskProcessors) {
            verb = "x";
        }
        else if (!this.eventLoopBlocked &&
            this.workers.length < this.options.minTaskProcessors) {
            verb = "+";
        }
        else if (!this.eventLoopBlocked &&
            this.workers.length < this.options.maxTaskProcessors &&
            (this.workers.length === 0 || workingCount / this.workers.length > 0.5)) {
            verb = "+";
        }
        else if (!this.eventLoopBlocked &&
            this.workers.length > this.options.minTaskProcessors &&
            workingCount / this.workers.length < 0.5) {
            verb = "-";
        }
        else {
            verb = "x";
        }
        if (verb === "x") {
            return { verb, eventLoopDelay: this.eventLoopDelay };
        }
        if (verb === "-") {
            worker = this.workers.pop();
            await worker.end();
            await this.cleanupWorker(worker);
            return { verb, eventLoopDelay: this.eventLoopDelay };
        }
        if (verb === "--") {
            this.stopInProcess = true;
            const promises = [];
            this.workers.forEach((worker) => {
                promises.push(new Promise(async (resolve) => {
                    await worker.end();
                    await this.cleanupWorker(worker);
                    return resolve(null);
                }));
            });
            await Promise.all(promises);
            this.stopInProcess = false;
            this.workers = [];
            return { verb, eventLoopDelay: this.eventLoopDelay };
        }
        if (verb === "+") {
            await this.startWorker();
            return { verb, eventLoopDelay: this.eventLoopDelay };
        }
    }
    async cleanupWorker(worker) {
        [
            "start",
            "end",
            "cleaning_worker",
            "poll",
            "ping",
            "job",
            "reEnqueue",
            "success",
            "failure",
            "error",
            "pause",
            "multiWorkerAction",
        ].forEach((e) => {
            worker.removeAllListeners(e);
        });
    }
    async checkWrapper() {
        clearTimeout(this.checkTimer);
        const { verb, eventLoopDelay } = await this.checkWorkers();
        this.emit("multiWorkerAction", verb, eventLoopDelay);
        this.checkTimer = setTimeout(() => {
            this.checkWrapper();
        }, this.options.checkTimeout);
    }
    start() {
        this.running = true;
        this.checkWrapper();
    }
    async stop() {
        this.running = false;
        await this.stopWait();
    }
    async end() {
        return this.stop();
    }
    async stopWait() {
        if (this.workers.length === 0 &&
            this.working === false &&
            !this.stopInProcess) {
            clearTimeout(this.checkTimer);
            return;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, this.options.checkTimeout);
        });
        return this.stopWait();
    }
}
exports.MultiWorker = MultiWorker;
