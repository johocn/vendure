import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    ListQueryOptions,
    PaginatedList,
    Permission,
    RequestContext,
    Transaction,
} from '@vendure/core';

import { OperationsPermissions } from '../constants';
import { CouponMarketingService } from './coupon.service';
import { FlashSaleMarketingService } from './flash-sale.service';
import { GroupBuyMarketingService } from './group-buy.service';
import { MarketingOverviewService } from './marketing-overview.service';

/**
 * Marketing admin resolver. Field names are prefixed with `marketing` where they
 * would otherwise collide with the dedicated FlashSale/GroupBuy/Coupon plugins
 * (which also contribute to the admin API schema).
 */
@Resolver()
export class MarketingAdminResolver {
    constructor(
        private flashSaleMarketingService: FlashSaleMarketingService,
        private groupBuyMarketingService: GroupBuyMarketingService,
        private couponMarketingService: CouponMarketingService,
        private marketingOverviewService: MarketingOverviewService,
    ) {}

    // ===== Overview =====

    @Query()
    @Allow(OperationsPermissions.ManagePromotion as Permission)
    async marketingOverview(@Ctx() ctx: RequestContext) {
        return this.marketingOverviewService.getOverview(ctx);
    }

    // ===== FlashSale (prefixed to avoid clash with FlashSalePlugin) =====

    @Query()
    async marketingFlashSaleActivities(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<any>,
    ): Promise<PaginatedList<any>> {
        return this.flashSaleMarketingService.findAll(ctx, options);
    }

    @Query()
    async marketingFlashSaleActivity(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.flashSaleMarketingService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    async createFlashSale(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.flashSaleMarketingService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    async updateFlashSale(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.flashSaleMarketingService.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    async deleteFlashSale(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.flashSaleMarketingService.delete(ctx, id);
    }

    // ===== GroupBuy (prefixed to avoid clash with GroupBuyPlugin) =====

    @Query()
    async marketingGroupBuyActivities(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<any>,
    ): Promise<PaginatedList<any>> {
        return this.groupBuyMarketingService.findAll(ctx, options);
    }

    @Query()
    async marketingGroupBuyActivity(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.groupBuyMarketingService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    async createGroupBuy(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.groupBuyMarketingService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    async updateGroupBuy(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.groupBuyMarketingService.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    async deleteGroupBuy(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.groupBuyMarketingService.delete(ctx, id);
    }

    // ===== Coupon (prefixed to avoid clash with CouponPlugin) =====

    @Query()
    async marketingCoupons(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<any>,
    ): Promise<PaginatedList<any>> {
        return this.couponMarketingService.findAll(ctx, options);
    }

    @Query()
    async marketingCoupon(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.couponMarketingService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    async marketingCreateCoupon(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.couponMarketingService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    async marketingUpdateCoupon(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ) {
        return this.couponMarketingService.update(ctx, id, input);
    }

    @Mutation()
    @Transaction()
    async marketingDeleteCoupon(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.couponMarketingService.delete(ctx, id);
    }

    @Mutation()
    @Transaction()
    async marketingEnableCouponForChannel(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponMarketingService.enableForChannel(ctx, id);
    }

    @Mutation()
    @Transaction()
    async marketingDisableCouponForChannel(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponMarketingService.disableForChannel(ctx, id);
    }
}
