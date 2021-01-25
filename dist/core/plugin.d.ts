import { Worker } from "./worker";
import { Connection } from "./connection";
import { Queue } from "./queue";
export declare abstract class Plugin {
    name: string;
    worker: Connection | Worker | any;
    queueObject: Queue;
    queue: string;
    func: string;
    job: {
        [key: string]: any;
    };
    args: Array<any>;
    options: {
        [key: string]: any;
    };
    constructor(worker: any, func: any, queue: any, job: any, args: any, options: any);
    abstract beforeEnqueue?(): void;
    abstract afterEnqueue?(): void;
    abstract beforePerform?(): void;
    abstract afterPerform?(): void;
}
