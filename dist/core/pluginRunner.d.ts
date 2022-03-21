import { Job } from "../types/job";
import { Worker } from "./worker";
import { Queue } from "./queue";
import { Plugin } from "./plugin";
declare type PluginConstructor<T> = new (...args: any[]) => T & {
    [key: string]: Plugin;
};
export declare function RunPlugins(self: Queue | Worker, type: string, func: string, queue: string, job: Job<unknown>, args: Array<any>, pluginCounter?: number): Promise<boolean>;
export declare function RunPlugin(self: Queue | Worker, PluginReference: string | PluginConstructor<unknown>, type: string, func: string, queue: string, job: Job<unknown>, args: Array<any>): Promise<boolean>;
export {};
