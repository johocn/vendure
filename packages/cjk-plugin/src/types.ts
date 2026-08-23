import { LanguageCode } from '@vendure/common/lib/generated-types';

export interface CjkPluginI18nOptions {
    enabled?: boolean;
    languages?: LanguageCode[];
}

export interface CjkPluginRegionsOptions {
    enabled?: boolean;
    countries?: ('CN' | 'JP' | 'KR')[];
}

export interface CjkPluginCodOptions {
    enabled?: boolean;
}

export interface CjkPluginStorePickupOptions {
    enabled?: boolean;
}

export interface CjkPluginPickupPointOptions {
    enabled?: boolean;
    shippingPrice?: number;
}

export interface TenantPromotionPolicy {
    couponStackable?: boolean;
    maxStackableCount?: number;
}

export interface CjkPluginTenantOptions {
    enabled?: boolean;
    defaultPaymentMethods?: string[];
    defaultShippingMethods?: string[];
    defaultPromotionPolicies?: TenantPromotionPolicy;
}

export interface CjkPluginPromotionPolicyOptions {
    enabled?: boolean;
    defaultStackable?: boolean;
    maxStackableCount?: number;
}

export interface CjkPluginEmployeePickupOptions {
    enabled?: boolean;
}

export interface CjkPluginOptions {
    i18n?: CjkPluginI18nOptions;
    regions?: CjkPluginRegionsOptions;
    cod?: CjkPluginCodOptions;
    /** 聚合码支付（线下扫码 + 自确认），默认启用，传 { enabled: false } 关闭 */
    aggregate?: { enabled?: boolean };
    storePickup?: CjkPluginStorePickupOptions;
    pickupPoint?: CjkPluginPickupPointOptions;
    employeePickup?: CjkPluginEmployeePickupOptions;
    tenant?: CjkPluginTenantOptions;
    promotionPolicy?: CjkPluginPromotionPolicyOptions;
    profiles?: CjkPluginProfilesOptions;
    /** 用于加密 authConfig 中凭证的密钥 */
    authSecret?: string;
    /** 启动时是否自动创建默认配送/支付数据（快递自提点、门店自提档案、门店收银档案），默认 true */
    seedDefaultData?: boolean;
}

export interface CjkPluginProfilesOptions {
    enabled?: boolean;
}
