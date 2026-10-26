import { ID, RequestContext } from '@vendure/core';
import { MerchantStorePublic, MerchantStoreService } from './merchant-store.service';
/**
 * 门店 C 端公开 API：附近门店列表与门店详情。
 * 仅返回 enabled && isPublic && 未删除 && 非 CLOSED 的门店。
 */
export declare class MerchantShopResolver {
    private merchantStoreService;
    constructor(merchantStoreService: MerchantStoreService);
    merchantStores(ctx: RequestContext, lat?: number, lng?: number, city?: string, merchantId?: ID, limit?: number): Promise<MerchantStorePublic[]>;
    merchantStorePublic(ctx: RequestContext, id: ID): Promise<MerchantStorePublic>;
}
