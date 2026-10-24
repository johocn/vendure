import { Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { WaimaiStoreService } from './waimai-store.service';

@Resolver()
export class WaimaiShopResolver {
    constructor(private stores: WaimaiStoreService) {}

    /** 公开只读：C 端首页店铺列表（跨渠道元数据聚合） */
    @Query()
    @Allow(Permission.Public)
    async waimaiStoreList(@Ctx() ctx: RequestContext) {
        return this.stores.listStores(ctx);
    }
}
