import { CustomerService, ID, ListQueryBuilder, ListQueryOptions, OrderService, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponCode } from './coupon-code.entity';
import { Coupon } from './coupon.entity';
export interface CouponOrderLineInput {
    productId: number;
    variantId: number;
    quantity: number;
    lineTotal: number;
    collectionIds: number[];
}
export interface CouponValidationResult {
    valid: boolean;
    discountAmount: number;
    error: string | null;
}
export declare class CouponService {
    private connection;
    private listQueryBuilder;
    private customerService;
    private orderService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService, orderService: OrderService);
    getCoupons(ctx: RequestContext, options?: ListQueryOptions<Coupon>): Promise<PaginatedList<Coupon>>;
    getCoupon(ctx: RequestContext, id: ID): Promise<Coupon | null>;
    createCoupon(ctx: RequestContext, input: Partial<Coupon>): Promise<Coupon>;
    /** updateCoupon 字段白名单：不允许修改 claimedCount / couponType / discountValue。 */
    updateCoupon(ctx: RequestContext, id: ID, input: Partial<Coupon>): Promise<Coupon>;
    deleteCoupon(ctx: RequestContext, id: ID): Promise<boolean>;
    /** 可领取的券：当前 channel、激活、活动期内、有库存。 */
    getAvailableCoupons(ctx: RequestContext): Promise<Coupon[]>;
    claimCoupon(ctx: RequestContext, couponId: ID): Promise<CouponCode>;
    getMyCoupons(ctx: RequestContext, status?: string): Promise<CouponCode[]>;
    /** 校验券码可用性并计算折扣金额（不修改状态）。 */
    validateCoupon(ctx: RequestContext, code: string, orderLines: CouponOrderLineInput[]): Promise<CouponValidationResult>;
    /** 核销：事务化，校验 + 标记 used。 */
    redeemCoupon(ctx: RequestContext, code: string, orderId: ID): Promise<CouponCode>;
    /** 释放：订单取消时归还券码。 */
    releaseCoupon(ctx: RequestContext, code: string): Promise<CouponCode>;
    /**
     * 将券码绑定到订单（设置 order.customFields.appliedCouponCode）。
     * 调用后，couponOrderAction 会在订单计算时自动应用折扣。
     * 不修改券码状态——状态变更由 OrderPlacedEvent 触发 redeemCoupon 完成。
     */
    applyCouponToOrder(ctx: RequestContext, orderId: ID, code: string): Promise<CouponValidationResult>;
    /** 订单取消时清除绑定的券码并释放券码。 */
    releaseCouponOnOrder(ctx: RequestContext, orderId: ID): Promise<void>;
    /** 过期所有 unused 且对应券已过 endAt 的券码。 */
    expireCoupons(ctx: RequestContext): Promise<number>;
    /** 将订单行映射为券校验所需的简化结构。供 resolver 与 redeemCoupon 复用。 */
    getOrderLinesForCoupon(ctx: RequestContext, orderId: ID): Promise<CouponOrderLineInput[]>;
    private mapOrderToLines;
    private computeEligibleTotal;
    private computeDiscount;
    private generateCode;
    private isNewCustomer;
}
