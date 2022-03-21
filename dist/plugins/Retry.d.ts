/// <reference types="ioredis" />
import { Plugin, Worker, ParsedJob, Queue } from "..";
export declare class Retry extends Plugin {
    constructor(worker: Queue | Worker, func: string, queue: string, job: ParsedJob, args: Array<any>, options: {
        [key: string]: any;
    });
    beforeEnqueue(): Promise<boolean>;
    afterEnqueue(): Promise<boolean>;
    beforePerform(): Promise<boolean>;
    afterPerform(): Promise<boolean>;
    argsKey(): string;
    retryKey(): string;
    failureKey(): string;
    maxDelay(): any;
    redis(): import("ioredis").Redis | import("ioredis").Cluster;
    attemptUp(): Promise<number>;
    saveLastError(): Promise<void>;
    cleanup(): Promise<void>;
}
