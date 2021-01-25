"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Noop = void 0;
const __1 = require("..");
class Noop extends __1.Plugin {
    afterPerform() {
        if (this.worker.error) {
            if (typeof this.options.logger === "function") {
                this.options.logger(this.worker.error);
            }
            else {
                console.log(this.worker.error);
            }
            delete this.worker.error;
        }
        return true;
    }
    beforeEnqueue() {
        return true;
    }
    afterEnqueue() {
        return true;
    }
    beforePerform() {
        return true;
    }
}
exports.Noop = Noop;
