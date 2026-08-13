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
    storePickup?: CjkPluginStorePickupOptions;
    pickupPoint?: CjkPluginPickupPointOptions;
    employeePickup?: CjkPluginEmployeePickupOptions;
    tenant?: CjkPluginTenantOptions;
    promotionPolicy?: CjkPluginPromotionPolicyOptions;
    profiles?: CjkPluginProfilesOptions;
    /** 用于加密 authConfig 中凭证的密钥 */
    authSecret?: string;
}
export interface CjkPluginProfilesOptions {
    enabled?: boolean;
}
