import { Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PointsMallPluginOptions } from './types';
export declare class PointsMallPlugin {
    private moduleRef;
    constructor(moduleRef: ModuleRef);
    static init(options?: PointsMallPluginOptions): Type<PointsMallPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
