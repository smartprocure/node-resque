/// <reference types="node" />
import { EventEmitter } from "events";
import * as IORedis from "ioredis";
import { ConnectionOptions } from "..";
export declare class Connection extends EventEmitter {
    options: ConnectionOptions | null;
    private eventListeners;
    connected: boolean;
    redis: IORedis.Redis | IORedis.Cluster;
    constructor(options?: ConnectionOptions);
    connect(): Promise<void>;
    loadLua(): void;
    getKeys(match: string, count?: number, keysAry?: any[], cursor?: number): any;
    end(): void;
    key(arg: any, arg2?: any, arg3?: any, arg4?: any): any;
}
