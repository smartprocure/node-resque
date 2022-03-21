import { Plugin } from "..";
export declare class Noop extends Plugin {
    afterPerform(): Promise<boolean>;
    beforeEnqueue(): Promise<boolean>;
    afterEnqueue(): Promise<boolean>;
    beforePerform(): Promise<boolean>;
}
