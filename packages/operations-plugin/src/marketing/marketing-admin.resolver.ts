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
import { FlashSaleMarketingService } from './flash-sale.service';
import { GroupBuyMarketingService } from './group-buy.service';
import { MarketingOverviewService } from './marketing-overview.service';

/**
 * Marketing admin resolver. Field names are prefixed with `marketing` where they
 * would otherwise collide with the dedicated FlashSale/GroupBuy plugins
 * (which also contribute to the admin API schema).
 *
 * 注：券（Coupon）部分已于 2026-09-30 移除 —— coupon-plugin 在 2026-09-19 重构为
 * `CouponTemplate` + `CustomerCoupon` 后，这里的 `marketingCoupons*` 只是调用旧 API 的
 * 死代码（无任何消费者，web-admin 直接用 coupon-plugin 自带的 `couponTemplates*`）。
 */
@Resolver()
export class MarketingAdminResolver {
    constructor(
        private flashSaleMarketingService: FlashSaleMarketingService,
        private groupBuyMarketingService: GroupBuyMarketingService,
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
        @Args('options', { nullable: true }) options: ListQueryOptions<any>,
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
        @Args('options', { nullable: true }) options: ListQueryOptions<any>,
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
}
