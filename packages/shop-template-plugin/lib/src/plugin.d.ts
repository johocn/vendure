import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ShopTemplatePluginOptions } from './types';
export declare class ShopTemplatePlugin implements OnApplicationBootstrap {
    private options;
    private moduleRef;
    private static options;
    private connection;
    constructor(options: ShopTemplatePluginOptions, moduleRef: ModuleRef);
    static init(options?: ShopTemplatePluginOptions): Type<ShopTemplatePlugin>;
    onApplicationBootstrap(): Promise<void>;
    /** 空库种子：3 套模板 × 双端 + 全局配置 2 条（幂等） */
    private seed;
}
