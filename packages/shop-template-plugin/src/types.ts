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

// theme.palette 结构（可选，任意 JSON 兼容）：
// { scheme: 'dawn-gold', name: '晨曦金', tokens: { primaryColor, accentColor, radius } }
// scheme 为 C 端预设字典 Key，tokens 为展开兜底（二者并存，优先 scheme 解码，
// 显式 tokens 再经 deepMerge 覆盖）。

export interface UpdateShopGlobalConfigInput {
    app: TemplateApp;
    themeTokens?: Record<string, any>;
    defaults?: Record<string, any>;
}
