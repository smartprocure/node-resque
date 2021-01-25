/// <reference types="ioredis" />
import { Plugin } from "..";
export declare class Retry extends Plugin {
    constructor(worker: any, func: any, queue: any, job: any, args: any, options: any);
    beforeEnqueue(): boolean;
    afterEnqueue(): boolean;
    beforePerform(): boolean;
    afterPerform(): Promise<boolean>;
    argsKey(): string;
    retryKey(): any;
    failureKey(): any;
    maxDelay(): any;
    redis(): import("ioredis").Redis | import("ioredis").Cluster;
    attemptUp(): Promise<number>;
    saveLastError(): Promise<void>;
    cleanup(): Promise<void>;
}
