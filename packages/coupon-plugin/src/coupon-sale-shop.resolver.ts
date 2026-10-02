import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, OrderService, Permission, RequestContext, Transaction } from '@vendure/core';

import { CouponSaleService } from './coupon-sale.service';

/**
 * 券商城（shop-api）：可售目录、出售单购买（微信 / 余额）、我的出售单，
 * 以及商品页加价购的挂载 / 摘除。全部要求登录（Permission.Authenticated），
 * 归属校验（本人 / 本渠道）在 CouponSaleService 内完成。
 */
@Resolver()
export class CouponSaleShopResolver {
    constructor(
        private couponSaleService: CouponSaleService,
        private orderService: OrderService,
    ) {}

    @Query()
    @Allow(Permission.Authenticated)
    async couponSaleCatalogue(@Ctx() ctx: RequestContext, @Args('scene', { nullable: true }) scene?: string) {
        return this.couponSaleService.saleCatalogue(ctx, scene ?? undefined);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myCouponSaleOrders(@Ctx() ctx: RequestContext) {
        return this.couponSaleService.mySaleOrders(ctx);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async createCouponSaleOrder(
        @Ctx() ctx: RequestContext,
        @Args('templateId', { nullable: true }) templateId?: ID,
        @Args('bundleId', { nullable: true }) bundleId?: ID,
    ) {
        return this.couponSaleService.createSaleOrder(ctx, templateId ?? null, bundleId ?? null);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async payCouponSaleWithBalance(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponSaleService.paySaleOrderWithBalance(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createWechatCouponPayment(
        @Ctx() ctx: RequestContext,
        @Args('saleOrderId') saleOrderId: ID,
        @Args('tradeType', { nullable: true }) tradeType?: string,
        @Args('openid', { nullable: true }) openid?: string,
    ) {
        const tt = (tradeType ?? 'JSAPI') as 'JSAPI' | 'NATIVE' | 'H5' | 'APP';
        return this.couponSaleService.createWechatCouponPayment(ctx, saleOrderId, tt, openid);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async cancelCouponSaleOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponSaleService.cancelSaleOrder(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async refundCouponSaleOrder(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reason', { nullable: true }) reason?: string,
    ) {
        return this.couponSaleService.refundSaleOrder(ctx, id, reason);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async attachCouponToOrder(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('templateId') templateId: ID,
    ) {
        return this.couponSaleService.attachCouponToOrder(ctx, orderId, templateId, this.orderService);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async detachCouponFromOrder(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('templateId') templateId: ID,
    ) {
        return this.couponSaleService.detachCouponFromOrder(ctx, orderId, templateId, this.orderService);
    }
}