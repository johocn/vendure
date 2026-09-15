import { DeepPartial, VendureEntity } from '@vendure/core';
import { TemplateApp } from './types';
/**
 * 风格模板：全局模板库（不按 channel 隔离），店铺通过 channel.customFields.templateId 引用。
 * JSON 用 simple-json 列（sqlite/postgres 双兼容）。
 */
export declare class ShopTemplate extends VendureEntity {
    constructor(input?: DeepPartial<ShopTemplate>);
    name: string;
    /** 目标端 nshop | vshop（创建后不可改，service 层校验） */
    app: TemplateApp;
    /** L2 模板级 token（primaryColor/accentColor/radius 等） */
    theme?: Record<string, any>;
    /** L3 页面/模块配置（按页 key：product/home/category/cart/profile） */
    pages?: Record<string, any>;
    /** 版本号（复制模板时 +1） */
    version: number;
    /** 停用后 C 端回退 L0/L1 */
    enabled: boolean;
}
