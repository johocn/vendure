import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { CouponMarketingService } from './coupon.service';
import { FlashSaleMarketingService } from './flash-sale.service';
import { GroupBuyMarketingService } from './group-buy.service';
import { MarketingOverviewService } from './marketing-overview.service';
/**
 * Marketing admin resolver. Field names are prefixed with `marketing` where they
 * would otherwise collide with the dedicated FlashSale/GroupBuy/Coupon plugins
 * (which also contribute to the admin API schema).
 */
export declare class MarketingAdminResolver {
    private flashSaleMarketingService;
    private groupBuyMarketingService;
    private couponMarketingService;
    private marketingOverviewService;
    constructor(flashSaleMarketingService: FlashSaleMarketingService, groupBuyMarketingService: GroupBuyMarketingService, couponMarketingService: CouponMarketingService, marketingOverviewService: MarketingOverviewService);
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
    marketingCoupons(ctx: RequestContext, options: ListQueryOptions<any>): Promise<PaginatedList<any>>;
    marketingCoupon(ctx: RequestContext, id: ID): Promise<any>;
    marketingCreateCoupon(ctx: RequestContext, input: any): Promise<any>;
    marketingUpdateCoupon(ctx: RequestContext, id: ID, input: any): Promise<any>;
    marketingDeleteCoupon(ctx: RequestContext, id: ID): Promise<boolean>;
    marketingEnableCouponForChannel(ctx: RequestContext, id: ID): Promise<any>;
    marketingDisableCouponForChannel(ctx: RequestContext, id: ID): Promise<any>;
}
