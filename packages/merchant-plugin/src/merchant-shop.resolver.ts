import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, UserInputError } from '@vendure/core';

import { MerchantStorePublic, MerchantStoreService } from './merchant-store.service';

/**
 * 门店 C 端公开 API：附近门店列表与门店详情。
 * 仅返回 enabled && isPublic && 未删除 && 非 CLOSED 的门店。
 */
@Resolver()
export class MerchantShopResolver {
    constructor(private merchantStoreService: MerchantStoreService) {}

    @Query()
    @Allow(Permission.Public)
    async merchantStores(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'lat', type: () => Number, nullable: true }) lat?: number,
        @Args({ name: 'lng', type: () => Number, nullable: true }) lng?: number,
        @Args({ name: 'city', type: () => String, nullable: true }) city?: string,
        @Args({ name: 'merchantId', type: () => String, nullable: true }) merchantId?: ID,
        @Args({ name: 'limit', type: () => Number, nullable: true }) limit?: number,
    ): Promise<MerchantStorePublic[]> {
        return this.merchantStoreService.findNearby(ctx, { lat, lng, city, merchantId, limit });
    }

    @Query()
    @Allow(Permission.Public)
    async merchantStorePublic(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<MerchantStorePublic> {
        const [store] = await this.merchantStoreService.findPublicByIds(ctx, [id]);
        if (!store) {
            throw new UserInputError('门店不存在或未公开');
        }
        return this.merchantStoreService.toPublic(store, { locale: ctx.languageCode });
    }
}
