import { Plugin } from "..";
export declare class Noop extends Plugin {
    afterPerform(): boolean;
    beforeEnqueue(): boolean;
    afterEnqueue(): boolean;
    beforePerform(): boolean;
}
