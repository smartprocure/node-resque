import { Worker } from "./worker";
import { Connection } from "./connection";
import { ParsedJob, Queue } from "./queue";
export declare abstract class Plugin {
    name: string;
    worker: Connection | Worker | any;
    queueObject: Queue;
    queue: string;
    func: string;
    job: ParsedJob;
    args: Array<any>;
    options: {
        [key: string]: any;
    };
    constructor(worker: Queue | Worker, func: string, queue: string, job: ParsedJob, args: Array<any>, options: {
        [key: string]: any;
    });
    abstract beforeEnqueue?(): Promise<boolean>;
    abstract afterEnqueue?(): Promise<boolean>;
    abstract beforePerform?(): Promise<boolean>;
    abstract afterPerform?(): Promise<boolean>;
}
