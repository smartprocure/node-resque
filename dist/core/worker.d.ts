/// <reference types="node" />
import { EventEmitter } from "events";
import { Jobs } from "..";
import { WorkerOptions } from "../types/options";
import { Connection } from "./connection";
import { ParsedJob, Queue } from "./queue";
export declare interface Worker {
    options: WorkerOptions;
    jobs: Jobs;
    started: boolean;
    name: string;
    queues: Array<string> | string;
    queue: string;
    originalQueue: string | null;
    error: Error | null;
    result: any;
    ready: boolean;
    running: boolean;
    working: boolean;
    pollTimer: NodeJS.Timeout;
    endTimer: NodeJS.Timeout;
    pingTimer: NodeJS.Timeout;
    job: ParsedJob;
    connection: Connection;
    queueObject: Queue;
    id: number;
    on(event: "start" | "end" | "pause", cb: () => void): this;
    on(event: "cleaning_worker", cb: (worker: Worker, pid: string) => void): this;
    on(event: "poll", cb: (queue: string) => void): this;
    on(event: "ping", cb: (time: number) => void): this;
    on(event: "job", cb: (queue: string, job: ParsedJob) => void): this;
    on(event: "reEnqueue", cb: (queue: string, job: ParsedJob, plugin: string) => void): this;
    on(event: "success", cb: (queue: string, job: ParsedJob, result: any, duration: number) => void): this;
    on(event: "failure", cb: (queue: string, job: ParsedJob, failure: Error, duration: number) => void): this;
    on(event: "error", cb: (error: Error, queue: string, job: ParsedJob) => void): this;
    once(event: "start" | "end" | "pause", cb: () => void): this;
    once(event: "cleaning_worker", cb: (worker: Worker, pid: string) => void): this;
    once(event: "poll", cb: (queue: string) => void): this;
    once(event: "ping", cb: (time: number) => void): this;
    once(event: "job", cb: (queue: string, job: ParsedJob) => void): this;
    once(event: "reEnqueue", cb: (queue: string, job: ParsedJob, plugin: string) => void): this;
    once(event: "success", cb: (queue: string, job: ParsedJob, result: any) => void): this;
    once(event: "failure", cb: (queue: string, job: ParsedJob, failure: any) => void): this;
    once(event: "error", cb: (error: Error, queue: string, job: ParsedJob) => void): this;
    removeAllListeners(event: string): this;
}
export declare type WorkerEvent = "start" | "end" | "cleaning_worker" | "poll" | "ping" | "job" | "reEnqueue" | "success" | "failure" | "error" | "pause";
export declare class Worker extends EventEmitter {
    constructor(options: WorkerOptions, jobs?: Jobs);
    connect(): Promise<void>;
    start(): Promise<void>;
    init(): Promise<void>;
    end(): Promise<void>;
    private poll;
    private perform;
    performInline(func: string, args?: any[]): Promise<any>;
    private completeJob;
    private succeed;
    private fail;
    private pause;
    private getJob;
    private track;
    private ping;
    private untrack;
    checkQueues(): Promise<void>;
    private failurePayload;
    private stringQueues;
}
