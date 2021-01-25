"use strict";
// inspired by https://github.com/tj/node-blocked
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLoopDelay = void 0;
function EventLoopDelay(limit, interval, fn) {
    let start = process.hrtime();
    const timeout = setInterval(() => {
        const delta = process.hrtime(start);
        const nanosec = delta[0] * 1e9 + delta[1];
        const ms = nanosec / 1e6;
        const n = ms - interval;
        if (n > limit) {
            fn(true, Math.round(n));
        }
        else {
            fn(false, Math.round(n));
        }
        start = process.hrtime();
    }, interval);
    if (timeout.unref) {
        timeout.unref();
    }
}
exports.EventLoopDelay = EventLoopDelay;
