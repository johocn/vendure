import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export declare class InventoryPlugin implements OnApplicationBootstrap {
    private moduleRef?;
    constructor(moduleRef?: ModuleRef | undefined);
    static init: () => typeof InventoryPlugin;
    private ledgerHandlerRegistered;
    onApplicationBootstrap(): Promise<void>;
}
