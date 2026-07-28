import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export declare class OperationsPlugin implements OnApplicationBootstrap {
    private moduleRef?;
    constructor(moduleRef?: ModuleRef | undefined);
    static init: () => typeof OperationsPlugin;
    onApplicationBootstrap(): Promise<void>;
}
