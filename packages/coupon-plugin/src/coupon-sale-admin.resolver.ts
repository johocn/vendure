import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';

import { CouponSaleService } from './coupon-sale.service';

/**
 * 券商城后台（admin-api）：券包 CRUD、出售单流水查询与退款。
 * 权限对齐订单管理（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
@Resolver()
export class CouponSaleAdminResolver {
    constructor(private couponSaleService: CouponSaleService) {}

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponBundles(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options?: any) {
        return this.couponSaleService.listBundles(ctx, {
            skip: options?.skip ?? 0,
            take: options?.take ?? 20,
        });
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponBundle(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponSaleService.findBundle(ctx, id);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponSaleOrders(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options?: any) {
        return this.couponSaleService.listSaleOrders(ctx, {
            skip: options?.skip ?? 0,
            take: options?.take ?? 20,
            status: options?.status ?? undefined,
        });
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponSaleOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponSaleService.findSaleOrder(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async createCouponBundle(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.couponSaleService.saveBundle(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async updateCouponBundle(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ) {
        return this.couponSaleService.saveBundle(ctx, input, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async deleteCouponBundle(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponSaleService.deleteBundle(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async refundCouponSaleOrder(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reason', { nullable: true }) reason?: string,
    ) {
        return this.couponSaleService.refundSaleOrder(ctx, id, reason);
    }
}