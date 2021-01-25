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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
const events_1 = require("events");
const os = __importStar(require("os"));
const pluginRunner_1 = require("./pluginRunner");
const queue_1 = require("./queue");
function prepareJobs(jobs) {
    return Object.keys(jobs).reduce(function (h, k) {
        const job = jobs[k];
        h[k] = typeof job === "function" ? { perform: job } : job;
        return h;
    }, {});
}
class Worker extends events_1.EventEmitter {
    constructor(options, jobs = {}) {
        super();
        const defaults = {
            name: os.hostname() + ":" + process.pid,
            queues: "*",
            timeout: 5000,
            looping: true,
            id: 1,
        };
        for (const i in defaults) {
            if (options[i] === undefined || options[i] === null) {
                options[i] = defaults[i];
            }
        }
        this.options = options;
        this.jobs = prepareJobs(jobs);
        this.name = this.options.name;
        this.queues = this.options.queues;
        this.queue = null;
        this.originalQueue = null;
        this.error = null;
        this.result = null;
        this.ready = true;
        this.running = false;
        this.working = false;
        this.job = null;
        this.pingTimer = null;
        this.started = false;
        this.queueObject = new queue_1.Queue({ connection: options.connection }, this.jobs);
        this.queueObject.on("error", (error) => {
            this.emit("error", error);
        });
    }
    async connect() {
        await this.queueObject.connect();
        this.connection = this.queueObject.connection;
        await this.checkQueues();
    }
    async start() {
        if (this.ready) {
            this.started = true;
            this.emit("start", new Date());
            await this.init();
            this.poll();
        }
    }
    async init() {
        await this.track();
        await this.connection.redis.set(this.connection.key("worker", this.name, this.stringQueues(), "started"), Math.round(new Date().getTime() / 1000));
        await this.ping();
        this.pingTimer = setInterval(this.ping.bind(this), this.options.timeout);
    }
    async end() {
        this.running = false;
        if (this.working === true) {
            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve(null);
                }, this.options.timeout);
            });
            return this.end();
        }
        if (this.connection &&
            (this.connection.connected === true ||
                this.connection.connected === undefined ||
                this.connection.connected === null)) {
            clearInterval(this.pingTimer);
            await this.untrack();
        }
        await this.queueObject.end();
        this.emit("end", new Date());
    }
    async poll(nQueue = 0) {
        if (!this.running)
            return;
        this.queue = this.queues[nQueue];
        this.emit("poll", this.queue);
        if (this.queue === null || this.queue === undefined) {
            await this.checkQueues();
            await this.pause();
            return null;
        }
        if (this.working === true) {
            const error = new Error("refusing to get new job, already working");
            this.emit("error", error, this.queue);
            return null;
        }
        this.working = true;
        try {
            const currentJob = await this.getJob();
            if (currentJob) {
                if (this.options.looping) {
                    this.result = null;
                    return this.perform(currentJob);
                }
                else {
                    return currentJob;
                }
            }
            else {
                this.working = false;
                if (nQueue === this.queues.length - 1) {
                    if (this.originalQueue === "*")
                        await this.checkQueues();
                    await this.pause();
                    return null;
                }
                else {
                    return this.poll(nQueue + 1);
                }
            }
        }
        catch (error) {
            this.emit("error", error, this.queue);
            this.working = false;
            await this.pause();
            return null;
        }
    }
    async perform(job) {
        this.job = job;
        this.error = null;
        let toRun;
        const startedAt = new Date().getTime();
        if (!this.jobs[job.class]) {
            this.error = new Error(`No job defined for class "${job.class}"`);
            return this.completeJob(false, startedAt);
        }
        const perform = this.jobs[job.class].perform;
        if (!perform || typeof perform !== "function") {
            this.error = new Error(`Missing Job: "${job.class}"`);
            return this.completeJob(false, startedAt);
        }
        this.emit("job", this.queue, this.job);
        let triedAfterPerform = false;
        try {
            toRun = await pluginRunner_1.RunPlugins(this, "beforePerform", job.class, this.queue, this.jobs[job.class], job.args);
            if (toRun === false) {
                return this.completeJob(false, startedAt);
            }
            let callableArgs = [job.args];
            if (job.args === undefined || job.args instanceof Array) {
                callableArgs = job.args;
            }
            for (const i in callableArgs) {
                if (typeof callableArgs[i] === "object" && callableArgs[i] !== null) {
                    Object.freeze(callableArgs[i]);
                }
            }
            this.result = await perform.apply(this, callableArgs);
            triedAfterPerform = true;
            toRun = await pluginRunner_1.RunPlugins(this, "afterPerform", job.class, this.queue, this.jobs[job.class], job.args);
            return this.completeJob(true, startedAt);
        }
        catch (error) {
            this.error = error;
            if (!triedAfterPerform) {
                try {
                    await pluginRunner_1.RunPlugins(this, "afterPerform", job.class, this.queue, this.jobs[job.class], job.args);
                }
                catch (error) {
                    if (error && !this.error) {
                        this.error = error;
                    }
                }
            }
            return this.completeJob(!this.error, startedAt);
        }
    }
    // #performInline is used to run a job payload directly.
    // If you are planning on running a job via #performInline, this worker should also not be started, nor should be using event emitters to monitor this worker.
    // This method will also not write to redis at all, including logging errors, modify resque's stats, etc.
    async performInline(func, args = []) {
        const q = "_direct-queue-" + this.name;
        let toRun;
        if (!(args instanceof Array)) {
            args = [args];
        }
        if (this.started) {
            throw new Error("Worker#performInline can not be used on a started worker");
        }
        if (!this.jobs[func]) {
            throw new Error(`No job defined for class "${func}"`);
        }
        if (!this.jobs[func].perform) {
            throw new Error(`Missing Job: "${func}"`);
        }
        try {
            toRun = await pluginRunner_1.RunPlugins(this, "beforePerform", func, q, this.jobs[func], args);
            if (toRun === false) {
                return;
            }
            this.result = await this.jobs[func].perform.apply(this, args);
            toRun = await pluginRunner_1.RunPlugins(this, "afterPerform", func, q, this.jobs[func], args);
            return this.result;
        }
        catch (error) {
            this.error = error;
            throw error;
        }
    }
    async completeJob(toRespond, startedAt) {
        const duration = new Date().getTime() - startedAt;
        if (this.error) {
            await this.fail(this.error, duration);
        }
        else if (toRespond) {
            await this.succeed(this.job, duration);
        }
        this.working = false;
        await this.connection.redis.del(this.connection.key("worker", this.name, this.stringQueues()));
        this.job = null;
        if (this.options.looping) {
            this.poll();
        }
    }
    async succeed(job, duration) {
        await this.connection.redis.incr(this.connection.key("stat", "processed"));
        await this.connection.redis.incr(this.connection.key("stat", "processed", this.name));
        this.emit("success", this.queue, job, this.result, duration);
    }
    async fail(err, duration) {
        await this.connection.redis.incr(this.connection.key("stat", "failed"));
        await this.connection.redis.incr(this.connection.key("stat", "failed", this.name));
        await this.connection.redis.rpush(this.connection.key("failed"), JSON.stringify(this.failurePayload(err, this.job)));
        this.emit("failure", this.queue, this.job, err, duration);
    }
    async pause() {
        this.emit("pause");
        await new Promise((resolve) => {
            setTimeout(() => {
                this.poll();
                resolve(null);
            }, this.options.timeout);
        });
    }
    async getJob() {
        let currentJob = null;
        const queueKey = this.connection.key("queue", this.queue);
        const workerKey = this.connection.key("worker", this.name, this.stringQueues());
        let encodedJob;
        if (this.connection.redis["popAndStoreJob"]) {
            encodedJob = await this.connection.redis["popAndStoreJob"](queueKey, workerKey, new Date().toString(), this.queue, this.name);
        }
        else {
            encodedJob = await this.connection.redis.lpop(queueKey);
            if (encodedJob) {
                await this.connection.redis.set(workerKey, JSON.stringify({
                    run_at: new Date().toString(),
                    queue: this.queue,
                    worker: this.name,
                    payload: JSON.parse(encodedJob),
                }));
            }
        }
        if (encodedJob)
            currentJob = JSON.parse(encodedJob);
        return currentJob;
    }
    async track() {
        this.running = true;
        return this.connection.redis.sadd(this.connection.key("workers"), this.name + ":" + this.stringQueues());
    }
    async ping() {
        const name = this.name;
        const nowSeconds = Math.round(new Date().getTime() / 1000);
        this.emit("ping", nowSeconds);
        const payload = JSON.stringify({
            time: nowSeconds,
            name: name,
            queues: this.stringQueues(),
        });
        await this.connection.redis.set(this.connection.key("worker", "ping", name), payload);
    }
    async untrack() {
        const name = this.name;
        const queues = this.stringQueues();
        if (!this.connection || !this.connection.redis) {
            return;
        }
        await this.connection.redis.srem(this.connection.key("workers"), name + ":" + queues);
        await this.connection.redis.del(this.connection.key("worker", "ping", name));
        await this.connection.redis.del(this.connection.key("worker", name, queues));
        await this.connection.redis.del(this.connection.key("worker", name, queues, "started"));
        await this.connection.redis.del(this.connection.key("stat", "failed", name));
        await this.connection.redis.del(this.connection.key("stat", "processed", name));
    }
    async checkQueues() {
        if (Array.isArray(this.queues) && this.queues.length > 0) {
            this.ready = true;
        }
        if ((this.queues[0] === "*" && this.queues.length === 1) ||
            this.queues.length === 0 ||
            this.originalQueue === "*") {
            this.originalQueue = "*";
            await this.untrack();
            const response = await this.connection.redis.smembers(this.connection.key("queues"));
            this.queues = response ? response.sort() : [];
            await this.track();
        }
    }
    failurePayload(err, job) {
        return {
            worker: this.name,
            queue: this.queue,
            payload: job,
            exception: err.name,
            error: err.message,
            backtrace: err.stack ? err.stack.split("\n").slice(1) : null,
            failed_at: new Date().toString(),
        };
    }
    stringQueues() {
        if (this.queues.length === 0) {
            return ["*"].join(",");
        }
        else {
            try {
                return this.queues.join(",");
            }
            catch (e) {
                return "";
            }
        }
    }
}
exports.Worker = Worker;
exports.Worker = Worker;
