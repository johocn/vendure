import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export declare class CustomerServicePlugin implements OnApplicationBootstrap {
    private moduleRef?;
    constructor(moduleRef?: ModuleRef | undefined);
    static init: () => typeof CustomerServicePlugin;
    onApplicationBootstrap(): Promise<void>;
}
