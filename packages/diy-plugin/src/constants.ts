export const loggerCtx = 'DiyPlugin';
export const PLUGIN_INIT_OPTIONS = Symbol('DIY_PLUGIN_OPTIONS');

/** 报价单默认有效期（天），quoteDiyPlan 时写入 expiresAt */
export const DEFAULT_QUOTE_TTL_DAYS = 7;

/** 载体商品/变体（Vendure OrderLine.productVariant 非空，DIY 成品行挂在它上面） */
export const CARRIER_PRODUCT_SLUG = 'diy-custom-carrier';
export const CARRIER_PRODUCT_NAME = 'DIY 定制成品';
export const CARRIER_VARIANT_SKU = 'DIY-CUSTOM';

/** 方案/报价/下单兜底租户端（与 ShopTemplatePlugin.init({app}) 同语义） */
export type DiyApp = 'nshop' | 'vshop';
