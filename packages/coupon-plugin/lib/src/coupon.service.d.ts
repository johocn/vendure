import { ID, Injector, ListQueryBuilder, ListQueryOptions, RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
export declare class CouponService {
    private connection;
    private listQueryBuilder;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder);
    private orderService;
    private customerService;
    private memberLevelService;
    private codePrefix;
    init(injector: Injector): void;
    findAllTemplates(ctx: RequestContext, options?: ListQueryOptions<CouponTemplate>): Promise<{
        items: CouponTemplate[];
        totalItems: number;
    }>;
    findOneTemplate(ctx: RequestContext, id: ID): Promise<CouponTemplate | undefined>;
    createTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate>;
    updateTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate>;
    deleteTemplate(ctx: RequestContext, id: ID): Promise<void>;
    couponCentre(ctx: RequestContext): Promise<CouponTemplate[]>;
    listMyCoupons(ctx: RequestContext, status?: string): Promise<CustomerCoupon[]>;
    listAllCoupons(ctx: RequestContext, options?: ListQueryOptions<CustomerCoupon>): Promise<{
        items: CustomerCoupon[];
        totalItems: number;
    }>;
    pointsMallTemplates(ctx: RequestContext): Promise<CouponTemplate[]>;
    exchangeWithPoints(ctx: RequestContext, templateId: ID): Promise<{
        coupon: CustomerCoupon;
        spentPoints: number;
    }>;
    claimCoupon(ctx: RequestContext, templateId: ID): Promise<CustomerCoupon>;
    grantCoupon(ctx: RequestContext, templateId: ID, customerIds: ID[]): Promise<string[]>;
    revokeCoupon(ctx: RequestContext, id: ID): Promise<CustomerCoupon>;
    applyCouponToOrder(ctx: RequestContext, orderId: ID, code: string): Promise<any>;
    clearCouponFromOrder(ctx: RequestContext, orderId: ID): Promise<any>;
    /** 支付成功后核销券 */
    bindAsUsed(ctx: RequestContext, orderId: ID): Promise<void>;
    /** 订单取消回退券（可复用） */
    returnCoupon(ctx: RequestContext, orderId: ID): Promise<void>;
    private orderCode;
    private currentCustomerId;
    private countHeld;
    /** 原子扣减发行余量；受影响数大于 0 表示成功 */
    private atomicIncrementClaimed;
    private createUserCoupon;
}
