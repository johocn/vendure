import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { SearchAssistService } from './search-assist.service';
import { WaimaiStoreService } from './waimai-store.service';

@Resolver()
export class WaimaiShopResolver {
    constructor(
        private stores: WaimaiStoreService,
        private assist: SearchAssistService,
    ) {}

    /** 公开只读：C 端首页店铺列表（跨渠道元数据聚合） */
    @Query()
    @Allow(Permission.Public)
    async waimaiStoreList(@Ctx() ctx: RequestContext) {
        return this.stores.listStores(ctx);
    }

    /**
     * 公开只读：语音/拍照搜索识别（P2-2）。
     * 按当前渠道配置选择服务商（mock / none），返回可直接用于站内搜索的关键词。
     */
    @Query()
    @Allow(Permission.Public)
    async campusSearchAssist(
        @Ctx() ctx: RequestContext,
        @Args('type') type: string,
        @Args('payload', { nullable: true }) payload?: string,
    ) {
        return this.assist.assist(ctx, type, payload);
    }
}
