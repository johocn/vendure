import { ID } from '@vendure/core';
export type TemplateApp = 'nshop' | 'vshop';
export interface ShopTemplatePluginOptions {
    /** 本实例所属端；缺省按环境变量 APP 推断，再缺省 nshop */
    app?: TemplateApp;
}
export interface CreateShopTemplateInput {
    name: string;
    app: TemplateApp;
    theme?: Record<string, any>;
    pages?: Record<string, any>;
    enabled?: boolean;
}
export interface UpdateShopTemplateInput {
    id: ID;
    name?: string;
    theme?: Record<string, any>;
    pages?: Record<string, any>;
    enabled?: boolean;
}
export interface UpdateShopGlobalConfigInput {
    app: TemplateApp;
    themeTokens?: Record<string, any>;
    defaults?: Record<string, any>;
}
