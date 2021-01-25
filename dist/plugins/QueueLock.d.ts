import { Plugin } from "..";
export declare class QueueLock extends Plugin {
    beforeEnqueue(): Promise<boolean>;
    afterEnqueue(): boolean;
    beforePerform(): Promise<boolean>;
    afterPerform(): boolean;
    lockTimeout(): any;
    key(): any;
}
