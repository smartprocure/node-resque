/// <reference types="node" />
import { EventEmitter } from "events";
import { ErrorPayload, Jobs } from "..";
import { QueueOptions } from "../types/options";
import { Connection } from "./connection";
export declare type ParsedJob = {
    class: string;
    queue: string;
    args: Array<any>;
    pluginOptions?: {
        [key: string]: any;
    };
};
export declare type ParsedWorkerPayload = {
    run_at: string;
    queue: string;
    worker: string;
    payload: ParsedJob;
};
export declare type ParsedFailedJobPayload = {
    worker: string;
    queue: string;
    payload: ParsedJob;
    failed_at: string;
    exception: string;
    error: string;
    backtrace: string[];
};
export declare interface Queue {
    connection: Connection;
    options: QueueOptions;
    jobs: Jobs;
    on(event: "error", cb: (error: Error, queue: string) => void): this;
    once(event: "error", cb: (error: Error, queue: string) => void): this;
}
export declare class Queue extends EventEmitter {
    constructor(options: QueueOptions, jobs?: Jobs);
    connect(): Promise<void>;
    end(): Promise<void>;
    encode(q: string, func: string, args?: Array<any>): string;
    /**
     * - Enqueue a named job (defined in `jobs` to be worked by a worker)
     * - The job will be added to the `queueName` queue, and that queue will be worked down by available workers assigned to that queue
     * - args is optional, but should be an array of arguments passed to the job. Order of arguments is maintained
     */
    enqueue(q: string, func: string, args?: Array<any>): Promise<boolean>;
    /**
     * - In ms, the unix timestamp at which this job is able to start being worked on.
     * - Depending on the number of other jobs in `queueName`, it is likely that this job will not be excecuted at exactly the time specified, but shortly thereafter.
     * - other options the same as `queue.enqueue`
     */
    enqueueAt(timestamp: number, q: string, func: string, args?: Array<any>, suppressDuplicateTaskError?: boolean): Promise<void>;
    /**
     * - In ms, the number of ms to delay before this job is able to start being worked on.
     *  - Depending on the number of other jobs in `queueName`, it is likely that this job will not be excecuted at exactly the delay specified, but shortly thereafter.
     * - other options the same as `queue.enqueue`
     */
    enqueueIn(time: number, q: string, func: string, args?: Array<any>, suppressDuplicateTaskError?: boolean): Promise<void>;
    /**
     * - queues is an Array with the names of all your queues
     */
    queues(): Promise<string[]>;
    /**
     * - delete a queue, and all jobs in that queue.
     */
    delQueue(q: string): Promise<void>;
    /**
     * - length is an integer counting the length of the jobs in the queue
     * - this does not include delayed jobs for this queue
     */
    length(q: string): Promise<number>;
    /**
     * - jobs are deleted by those matching a `func` and argument collection within a given queue.
     * - You might match none, or you might match many.
     */
    del(q: string, func: string, args?: Array<any>, count?: number): Promise<number>;
    /**
     * delByFunction
     *  * will delete all jobs in the given queue of the named function/class
     *  * will not prevent new jobs from being added as this method is running
     *  * will not delete jobs in the delayed queues
     * @param q - queue to look in
     * @param func - function name to delete any jobs with
     * @param start - optional place to start looking in list (default: beginning of list)
     * @param stop - optional place to end looking in list (default: end of list)
     * @returns number of jobs deleted from queue
     */
    delByFunction(q: string, func: string, start?: number, stop?: number): Promise<number>;
    delDelayed(q: string, func: string, args?: Array<any>): Promise<number[]>;
    /**
     * - learn the timestamps at which a job is scheduled to be run.
     * - `timestampsForJob` is an array of integers
     */
    scheduledAt(q: string, func: string, args?: Array<any>): Promise<number[]>;
    /**
     * - `timestamps` is an array of integers for all timestamps which have at least one job scheduled in the future
     */
    timestamps(): Promise<number[]>;
    /**
     * - `jobsEnqueuedForThisTimestamp` is an array, matching the style of the response of `queue.queued`
     */
    delayedAt(timestamp: number): Promise<{
        tasks: ParsedJob[];
        rTimestamp: number;
    }>;
    /**
     * - list all the jobs (with their payloads) in a queue between start index and stop index.
     * - jobs is an array containing the payload of the job enqueued
     */
    queued(q: string, start: number, stop: number): Promise<any[]>;
    /**
     * - jobsHash is an object with its keys being timestamps, and the values are arrays of jobs at each time.
     * - note that this operation can be very slow and very ram-heavy
     */
    allDelayed(): Promise<{
        [key: string]: any[];
    }>;
    /**
     * - types of locks include queue and worker locks, as created by the plugins below
     * - `locks` is a hash by type and timestamp
     */
    locks(): Promise<{
        [key: string]: string;
    }>;
    /**
     * - `count` is an integer. You might delete more than one lock by the name.
     */
    delLock(key: string): Promise<number>;
    /**
     * - returns a hash of the form: `{ 'host:pid': 'queue1, queue2', 'host:pid': 'queue1, queue2' }`
     */
    workers(): Promise<{
        [key: string]: string;
    }>;
    /**
     * - returns: `{"run_at":"Fri Dec 12 2014 14:01:16 GMT-0800 (PST)","queue":"test_queue","payload":{"class":"slowJob","queue":"test_queue","args":[null]},"worker":"workerA"}`
     */
    workingOn(workerName: string, queues: string): Promise<string>;
    /**
     * - returns a hash of the results of `queue.workingOn` with the worker names as keys.
     */
    allWorkingOn(): Promise<{
        [key: string]: ParsedWorkerPayload;
    }>;
    forceCleanWorker(workerName: string): Promise<ErrorPayload>;
    cleanOldWorkers(age: number): Promise<{
        [key: string]: any;
    }>;
    /**
     * - `failedCount` is the number of jobs in the failed queue
     */
    failedCount(): Promise<number>;
    /**
     * - `failedJobs` is an array listing the data of the failed jobs. Each element looks like:
     * ```
     * {"worker": "host:pid", "queue": "test_queue", "payload": {"class":"slowJob", "queue":"test_queue", "args":[null]}, "exception": "TypeError", "error": "MyImport is not a function", "backtrace": [' at Worker.perform (/path/to/worker:111:24)', ' at <anonymous>'], "failed_at": "Fri Dec 12 2014 14:01:16 GMT-0800 (PST)"}\
     * ```
     * - To retrieve all failed jobs, use arguments: `await queue.failed(0, -1)`
     */
    failed(start: number, stop: number): Promise<ParsedFailedJobPayload[]>;
    removeFailed(failedJob: ErrorPayload): Promise<number>;
    retryAndRemoveFailed(failedJob: ErrorPayload): Promise<boolean>;
    /**
     * Look though the failed jobs to find those which were failed as a result of forceCleanWorker and re-enqueue them.
     * This is potentially very slow if you have a lot of failed jobs
     */
    retryStuckJobs(upperLimit?: number): Promise<void>;
    /**
     * Return the currently elected leader
     */
    leader(): Promise<string>;
    /**
     * - stats will be a hash containing details about all the queues in your redis, and how many jobs are in each, and who the leader is
     */
    stats(): Promise<{
        [key: string]: any;
    }>;
    /**
     * The redis key which holds the currently elected leader
     */
    leaderKey(): string;
}
