"use strict";
// If a job with the same name, queue, and args is already in the delayed queue(s), do not enqueue it again
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelayQueueLock = void 0;
const __1 = require("..");
class DelayQueueLock extends __1.Plugin {
    async beforeEnqueue() {
        const timestamps = await this.queueObject.scheduledAt(this.queue, this.func, this.args);
        if (timestamps.length > 0) {
            return false;
        }
        else {
            return true;
        }
    }
    afterEnqueue() {
        return true;
    }
    beforePerform() {
        return true;
    }
    afterPerform() {
        return true;
    }
}
exports.DelayQueueLock = DelayQueueLock;
exports.DelayQueueLock = DelayQueueLock;
