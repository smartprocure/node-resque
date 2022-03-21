import { Plugin } from "..";
export declare class DelayQueueLock extends Plugin {
    beforeEnqueue(): Promise<boolean>;
    afterEnqueue(): Promise<boolean>;
    beforePerform(): Promise<boolean>;
    afterPerform(): Promise<boolean>;
}
