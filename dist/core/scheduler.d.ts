/// <reference types="node" />
import { EventEmitter } from "events";
import { ErrorPayload, Job, Jobs } from "..";
import { SchedulerOptions } from "../types/options";
import { Connection } from "./connection";
import { Queue } from "./queue";
import RedlockLeader from "redlock-leader";
export declare interface Scheduler {
    options: SchedulerOptions;
    jobs: Jobs;
    name: string;
    leader: boolean;
    running: boolean;
    processing: boolean;
    queue: Queue;
    connection: Connection;
    timer: NodeJS.Timeout;
    redlock: RedlockLeader;
    on(event: "start" | "end" | "poll" | "leader", cb: () => void): this;
    on(event: "cleanStuckWorker", cb: (workerName: string, errorPayload: ErrorPayload, delta: number) => void): this;
    on(event: "error", cb: (error: Error, queue: string) => void): this;
    on(event: "workingTimestamp", cb: (timestamp: number) => void): this;
    on(event: "transferredJob", cb: (timestamp: number, job: Job<any>) => void): this;
    once(event: "start" | "end" | "poll" | "leader", cb: () => void): this;
    once(event: "cleanStuckWorker", cb: (workerName: string, errorPayload: ErrorPayload, delta: number) => void): this;
    once(event: "error", cb: (error: Error, queue: string) => void): this;
    once(event: "workingTimestamp", cb: (timestamp: number) => void): this;
    once(event: "transferredJob", cb: (timestamp: number, job: Job<any>) => void): this;
    removeAllListeners(event: SchedulerEvent): this;
}
export declare type SchedulerEvent = "start" | "end" | "poll" | "leader" | "cleanStuckWorker" | "error" | "workingTimestamp" | "transferredJob";
export declare class Scheduler extends EventEmitter {
    constructor(options: any, jobs?: {});
    connect(): Promise<void>;
    start(): Promise<void>;
    end(): Promise<unknown>;
    poll(): any;
    private pollAgainLater;
    private nextDelayedTimestamp;
    private enqueueDelayedItemsForTimestamp;
    private nextItemForTimestamp;
    private transfer;
    private cleanupTimestamp;
    private checkStuckWorkers;
    forceCleanWorker(workerName: any, delta: any): Promise<void>;
    private watchIfPossible;
    private unwatchIfPossible;
}
