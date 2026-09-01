import { I18nError, ID, Injector, ListQueryBuilder, ListQueryOptions, RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
/**
 * 属店权限不足错误。本版本 Vendure 的 ForbiddenError 构造器固定 message='error.forbidden'（code='FORBIDDEN'），
 * 无法注入自定义文案；故继承 I18nError，沿用 FORBIDDEN 错误码，以显式携带 COUPON_NOT_OWNED 语义消息。
 */
export declare class CouponNotOwnedError extends I18nError {
    constructor();
}
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
    /** 默认商城渠道下，本商城商品（Product.customFields.shopId）中出现过的店铺 id 集合。 */
    private shopIdsPresentInChannel;
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
    /**
     * 归属解析：activeUserId → Administrator.user → Shop.administratorId（与 shop-plugin 同法，不依赖 ctx.channelId）。
     * 若连接未注册 Shop 实体（shop-plugin 未加载）或 admin 无法解析，则回退为 undefined（不阻断）。
     *
     * 公开（public）：供 CouponAdminResolver 等鉴权调用点复用，避免在 service 内重复实现。
     * 保持签名兼容，Task B 既有的私有调用不受影响。
     */
    resolveShopIdFromActiveUser(ctx: RequestContext, userId?: ID): Promise<number | undefined>;
    /**
     * 原则：超级管理员（无属店 Shop）可管理全部券；属店管理员只能管理「平台级券（shopId 为空）
     * + 本店发行的券」，其余一率抛 ForbiddenError(COUPON_NOT_OWNED)。
     * 供 resolver 与列表过滤复用。
     */
    assertManagedByShop(ctx: RequestContext, targetShopId?: number): Promise<void>;
    /** 按实体名称从连接元数据中取回实体类（用于在插件未直接依赖 Shop 时安全解析）。 */
    findEntityClass(name: string): any | undefined;
    private orderCode;
    private currentCustomerId;
    private countHeld;
    /** 原子扣减发行余量；受影响数大于 0 表示成功 */
    private atomicIncrementClaimed;
    private createUserCoupon;
}
