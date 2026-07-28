import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export declare class DeliveryPlugin implements OnApplicationBootstrap {
    private moduleRef?;
    constructor(moduleRef?: ModuleRef | undefined);
    static init: () => typeof DeliveryPlugin;
    onApplicationBootstrap(): Promise<void>;
}
