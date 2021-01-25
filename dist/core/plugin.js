"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plugin = void 0;
class Plugin {
    constructor(worker, func, queue, job, args, options) {
        var _a;
        this.name = ((_a = this === null || this === void 0 ? void 0 : this.constructor) === null || _a === void 0 ? void 0 : _a.name) || "Node Resque Plugin";
        this.worker = worker;
        this.queue = queue;
        this.func = func;
        this.job = job;
        this.args = args;
        this.options = options;
        if (this.worker && this.worker.queueObject) {
            this.queueObject = this.worker.queueObject;
        }
        else {
            this.queueObject = this.worker;
        }
    }
}
exports.Plugin = Plugin;
