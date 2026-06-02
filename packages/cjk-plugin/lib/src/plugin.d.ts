import { MiddlewareConsumer, NestModule, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CjkPluginOptions } from './types';
export declare class CjkPlugin implements OnApplicationBootstrap, NestModule {
    private options;
    private moduleRef;
    private static options;
    constructor(options: CjkPluginOptions, moduleRef: ModuleRef);
    static init(options: CjkPluginOptions): Type<CjkPlugin>;
    onApplicationBootstrap(): Promise<void>;
    configure(consumer: MiddlewareConsumer): void;
}
