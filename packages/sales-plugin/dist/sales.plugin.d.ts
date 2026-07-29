import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export declare class SalesPlugin implements OnApplicationBootstrap {
    private moduleRef?;
    constructor(moduleRef?: ModuleRef | undefined);
    static init: () => typeof SalesPlugin;
    onApplicationBootstrap(): Promise<void>;
}
