import { DeepPartial, VendureEntity } from '@vendure/core';
import { TemplateApp } from './types';
/** 全局配置（L1 底层）：每 app 一条 */
export declare class ShopGlobalConfig extends VendureEntity {
    constructor(input?: DeepPartial<ShopGlobalConfig>);
    app: TemplateApp;
    themeTokens?: Record<string, any>;
    defaults?: Record<string, any>;
}
