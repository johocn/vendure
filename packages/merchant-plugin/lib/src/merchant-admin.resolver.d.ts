import { ID, RequestContext } from '@vendure/core';
import { Merchant } from './merchant.entity';
import { MerchantStore } from './merchant-store.entity';
import { MerchantStoreService } from './merchant-store.service';
/**
 * 商户/门店后台 API：读写商户主数据、门店、租户认领关系与门店员工。
 * 商户与门店是平台级主数据（非 ChannelAware），后台读写一律仅平台超管，
 * 避免租户枚举全平台商户/门店；C 端只走 shop-api 的公开投影。
 */
export declare class MerchantAdminResolver {
    private merchantStoreService;
    constructor(merchantStoreService: MerchantStoreService);
    merchants(ctx: RequestContext, options: any): Promise<any>;
    merchant(ctx: RequestContext, id: ID): Promise<Merchant | undefined>;
    merchantStores(ctx: RequestContext, options: any): Promise<any>;
    merchantStore(ctx: RequestContext, id: ID): Promise<MerchantStore | undefined>;
    merchantStoreClaims(ctx: RequestContext, storeId: ID): Promise<any[]>;
    merchantStoreStaff(ctx: RequestContext, storeId: ID): Promise<any[]>;
    createMerchant(ctx: RequestContext, input: any): Promise<Merchant>;
    updateMerchant(ctx: RequestContext, input: any): Promise<Merchant>;
    /** 删除商户（软删）：仍存在未删除门店时拒绝 */
    deleteMerchant(ctx: RequestContext, id: ID): Promise<boolean>;
    createMerchantStore(ctx: RequestContext, input: any): Promise<MerchantStore>;
    updateMerchantStore(ctx: RequestContext, input: any): Promise<MerchantStore>;
    /** 删除门店（软删），并撤销其 ACTIVE 租户认领 */
    deleteMerchantStore(ctx: RequestContext, id: ID): Promise<boolean>;
    claimMerchantStore(ctx: RequestContext, storeId: ID, channelId: ID, role?: string, contractNo?: string): Promise<any>;
    revokeMerchantStoreClaim(ctx: RequestContext, storeId: ID, channelId: ID): Promise<boolean>;
    upsertMerchantStoreStaff(ctx: RequestContext, input: any): Promise<any>;
    removeMerchantStoreStaff(ctx: RequestContext, storeId: ID, userId: ID): Promise<boolean>;
}
/** Merchant.name / intro 的本地化输出解析 */
export declare class MerchantFieldResolver {
    name(merchant: Merchant, ctx: RequestContext): string;
    intro(merchant: Merchant, ctx: RequestContext): string | null;
    legalName(merchant: Merchant, ctx: RequestContext): string | null;
    licenseNo(merchant: Merchant, ctx: RequestContext): string | null;
    licenseImage(merchant: Merchant, ctx: RequestContext): string | null;
    bankName(merchant: Merchant, ctx: RequestContext): string | null;
    bankAccountName(merchant: Merchant, ctx: RequestContext): string | null;
    bankAccountNo(merchant: Merchant, ctx: RequestContext): string | null;
    taxNo(merchant: Merchant, ctx: RequestContext): string | null;
    invoiceTitle(merchant: Merchant, ctx: RequestContext): string | null;
    private static mask;
}
/** MerchantStore.name / notice 的本地化输出解析，simple-json 字段统一序列化为 JSON 字符串 */
export declare class MerchantStoreFieldResolver {
    name(store: MerchantStore, ctx: RequestContext): string;
    notice(store: MerchantStore, ctx: RequestContext): string | null;
    businessHours(store: MerchantStore): string | null;
    specialDates(store: MerchantStore): string | null;
    holidayPlan(store: MerchantStore): string | null;
    externalIds(store: MerchantStore): string | null;
    private static jsonText;
}
