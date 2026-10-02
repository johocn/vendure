import { ID, OrderService, RequestContext } from '@vendure/core';
import { CouponSaleService } from './coupon-sale.service';
/**
 * 券商城（shop-api）：可售目录、出售单购买（微信 / 余额）、我的出售单，
 * 以及商品页加价购的挂载 / 摘除。全部要求登录（Permission.Authenticated），
 * 归属校验（本人 / 本渠道）在 CouponSaleService 内完成。
 */
export declare class CouponSaleShopResolver {
    private couponSaleService;
    private orderService;
    constructor(couponSaleService: CouponSaleService, orderService: OrderService);
    couponSaleCatalogue(ctx: RequestContext, scene?: string): Promise<{
        templates: import("./coupon-template.entity").CouponTemplate[];
        bundles: import("./coupon-bundle.entity").CouponBundle[];
    }>;
    myCouponSaleOrders(ctx: RequestContext): Promise<import("./coupon-sale-order.entity").CouponSaleOrder[]>;
    createCouponSaleOrder(ctx: RequestContext, templateId?: ID, bundleId?: ID): Promise<import("./coupon-sale-order.entity").CouponSaleOrder>;
    payCouponSaleWithBalance(ctx: RequestContext, id: ID): Promise<import("./coupon-sale-order.entity").CouponSaleOrder>;
    createWechatCouponPayment(ctx: RequestContext, saleOrderId: ID, tradeType?: string, openid?: string): Promise<any>;
    cancelCouponSaleOrder(ctx: RequestContext, id: ID): Promise<import("./coupon-sale-order.entity").CouponSaleOrder>;
    refundCouponSaleOrder(ctx: RequestContext, id: ID, reason?: string): Promise<import("./coupon-sale-order.entity").CouponSaleOrder>;
    attachCouponToOrder(ctx: RequestContext, orderId: ID, templateId: ID): Promise<import("./coupon-sale-order.entity").CouponSaleOrder>;
    detachCouponFromOrder(ctx: RequestContext, orderId: ID, templateId: ID): Promise<boolean>;
}
