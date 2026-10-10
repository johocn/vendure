import { Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export declare class PointsMallPlugin {
    private moduleRef;
    constructor(moduleRef: ModuleRef);
    static init(): Type<PointsMallPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
