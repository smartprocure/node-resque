import { Plugin } from "..";
export declare class JobLock extends Plugin {
    beforeEnqueue(): boolean;
    afterEnqueue(): boolean;
    beforePerform(): Promise<boolean>;
    afterPerform(): Promise<boolean>;
    reEnqueue(): Promise<void>;
    lockTimeout(): any;
    enqueueTimeout(): any;
    key(): any;
}
