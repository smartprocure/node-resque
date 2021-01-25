/// <reference types="node" />
import { EventEmitter } from "events";
import { Worker } from "./worker";
import { MultiWorkerOptions } from "../types/options";
import { Jobs, Job, JobEmit } from "..";
export declare interface MultiWorker {
    options: MultiWorkerOptions;
    jobs: Jobs;
    workers: Array<Worker>;
    name: string;
    running: boolean;
    working: boolean;
    eventLoopBlocked: boolean;
    eventLoopDelay: number;
    eventLoopCheckCounter: number;
    stopInProcess: boolean;
    checkTimer: NodeJS.Timeout;
    on(event: "start" | "end", cb: (workerId: number) => void): this;
    on(event: "cleaning_worker", cb: (workerId: number, worker: Worker, pid: number) => void): this;
    on(event: "poll", cb: (workerId: number, queue: string) => void): this;
    on(event: "ping", cb: (workerId: number, time: number) => void): this;
    on(event: "job", cb: (workerId: number, queue: string, job: Job<any> | JobEmit) => void): this;
    on(event: "reEnqueue", cb: (workerId: number, queue: string, job: Job<any> | JobEmit, plugin: string) => void): this;
    on(event: "success", cb: (workerId: number, queue: string, job: Job<any> | JobEmit, result: any, duration: number) => void): this;
    on(event: "failure", cb: (workerId: number, queue: string, job: Job<any> | JobEmit, failure: any, duration: number) => void): this;
    on(event: "error", cb: (workerId: number, queue: string, job: Job<any> | JobEmit, error: any) => void): this;
    on(event: "pause", cb: (workerId: number) => void): this;
    on(event: "multiWorkerAction", cb: (verb: string, delay: number) => void): this;
}
export declare class MultiWorker extends EventEmitter {
    constructor(options: any, jobs: any);
    private PollEventLoopDelay;
    private startWorker;
    private checkWorkers;
    private cleanupWorker;
    private checkWrapper;
    start(): void;
    stop(): Promise<void>;
    end(): Promise<void>;
    private stopWait;
}
