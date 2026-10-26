import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';

import { CouponStoreService } from './coupon-store.service';

/**
 * 券 ↔ 门店（admin-api）：绑定维护 + 核销流水查询。
 * 权限对齐订单管理（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
@Resolver()
export class CouponStoreAdminResolver {
    constructor(private couponStoreService: CouponStoreService) {}

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponStoreBindings(@Ctx() ctx: RequestContext, @Args('templateId') templateId: ID) {
        return this.couponStoreService.listBindings(ctx, templateId);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async setCouponStoreBindings(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
        @Args('storeIds') storeIds: ID[],
        @Args('coverage', { nullable: true }) coverage?: string,
    ) {
        return this.couponStoreService.setBindings(ctx, templateId, storeIds, coverage ?? null);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponRedemptions(
        @Ctx() ctx: RequestContext,
        @Args('templateId', { nullable: true }) templateId?: ID,
        @Args('storeId', { nullable: true }) storeId?: ID,
        @Args('limit', { nullable: true }) limit?: number,
    ) {
        return this.couponStoreService.listRedemptions(ctx, templateId ?? null, storeId ?? null, limit ?? null);
    }
}
