import { Plugin } from "..";
export declare class QueueLock extends Plugin {
    beforeEnqueue(): Promise<boolean>;
    afterEnqueue(): Promise<boolean>;
    beforePerform(): Promise<boolean>;
    afterPerform(): Promise<boolean>;
    lockTimeout(): any;
    key(): any;
}
