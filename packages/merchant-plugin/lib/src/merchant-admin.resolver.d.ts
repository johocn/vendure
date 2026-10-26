import { ID, RequestContext } from '@vendure/core';
import { Merchant } from './merchant.entity';
import { MerchantStore } from './merchant-store.entity';
import { MerchantStoreService } from './merchant-store.service';
/**
 * 商户/门店后台 API：读写商户主数据、门店、租户认领关系与门店员工。
 * 权限沿用订单更新权限（Permission.UpdateOrder），与既有运营插件保持一致。
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
    createMerchantStore(ctx: RequestContext, input: any): Promise<MerchantStore>;
    updateMerchantStore(ctx: RequestContext, input: any): Promise<MerchantStore>;
    claimMerchantStore(ctx: RequestContext, storeId: ID, channelId: ID, role?: string, contractNo?: string): Promise<any>;
    revokeMerchantStoreClaim(ctx: RequestContext, storeId: ID, channelId: ID): Promise<boolean>;
    upsertMerchantStoreStaff(ctx: RequestContext, input: any): Promise<any>;
}
/** Merchant.name / intro 的本地化输出解析 */
export declare class MerchantFieldResolver {
    name(merchant: Merchant, ctx: RequestContext): string;
    intro(merchant: Merchant, ctx: RequestContext): string | null;
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
