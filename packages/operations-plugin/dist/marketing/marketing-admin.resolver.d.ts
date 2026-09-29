import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
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
export declare class MarketingAdminResolver {
    private flashSaleMarketingService;
    private groupBuyMarketingService;
    private marketingOverviewService;
    constructor(flashSaleMarketingService: FlashSaleMarketingService, groupBuyMarketingService: GroupBuyMarketingService, marketingOverviewService: MarketingOverviewService);
    marketingOverview(ctx: RequestContext): Promise<import("./marketing-overview.service").MarketingOverview>;
    marketingFlashSaleActivities(ctx: RequestContext, options: ListQueryOptions<any>): Promise<PaginatedList<any>>;
    marketingFlashSaleActivity(ctx: RequestContext, id: ID): Promise<any>;
    createFlashSale(ctx: RequestContext, input: any): Promise<any>;
    updateFlashSale(ctx: RequestContext, input: any): Promise<any>;
    deleteFlashSale(ctx: RequestContext, id: ID): Promise<boolean>;
    marketingGroupBuyActivities(ctx: RequestContext, options: ListQueryOptions<any>): Promise<PaginatedList<any>>;
    marketingGroupBuyActivity(ctx: RequestContext, id: ID): Promise<any>;
    createGroupBuy(ctx: RequestContext, input: any): Promise<any>;
    updateGroupBuy(ctx: RequestContext, input: any): Promise<any>;
    deleteGroupBuy(ctx: RequestContext, id: ID): Promise<boolean>;
}
