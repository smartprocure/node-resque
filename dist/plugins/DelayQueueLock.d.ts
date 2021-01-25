import { Plugin } from "..";
export declare class DelayQueueLock extends Plugin {
    beforeEnqueue(): Promise<boolean>;
    afterEnqueue(): boolean;
    beforePerform(): boolean;
    afterPerform(): boolean;
}
