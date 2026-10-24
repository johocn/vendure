import { RequestContext } from '@vendure/core';
import { WaimaiStoreService } from './waimai-store.service';
export declare class WaimaiShopResolver {
    private stores;
    constructor(stores: WaimaiStoreService);
    /** 公开只读：C 端首页店铺列表（跨渠道元数据聚合） */
    waimaiStoreList(ctx: RequestContext): Promise<import("./waimai-store.service").WaimaiStore[]>;
}
