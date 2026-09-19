import { Customer, I18nError, ID, Injector, ListQueryBuilder, ListQueryOptions, RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponBindingService } from './coupon-binding.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { ProductCouponBinding } from './product-coupon-binding.entity';
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
    private bindingService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, bindingService: CouponBindingService);
    private orderService;
    private customerService;
    private memberLevelService;
    private codePrefix;
    init(injector: Injector): void;
    /**
     * 将模板上的 memberLevel 字符串解析为所需最低档位（1-5）。
     * 支持：纯数字（"3"→3）、英文档位码（gold→3）、中文档位名（金卡会员→3）。
     * 无法解析或空 → 返回 null（不设限，fail-open）。对未知文案保持宽容，避免误伤。
     */
    resolveRequiredMemberLevel(memberLevel?: string | null): Promise<number | null>;
    /**
     * 会员等级门槛判定（非阻塞）。memberLevel 未设 / 解析失败 / 会员插件未注册 → 放行；
     * 否则要求顾客当前档位 >= 所需档位。
     */
    couponMeetsMemberLevel(ctx: RequestContext, customerId: number, tpl: CouponTemplate): Promise<boolean>;
    /** 会员等级门槛校验（抛错）。 */
    assertCouponMemberLevel(ctx: RequestContext, customerId: number, tpl: CouponTemplate): Promise<void>;
    findAllTemplates(ctx: RequestContext, options?: ListQueryOptions<CouponTemplate>): Promise<{
        items: CouponTemplate[];
        totalItems: number;
    }>;
    findOneTemplate(ctx: RequestContext, id: ID): Promise<CouponTemplate | undefined>;
    createTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate>;
    updateTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate>;
    /**
     * 多语言合并：nameZh/nameEn/descZh/descEn 按需写入，产出 LocalizedText 对象，
     * 并保留既有的其它语言文案。任一多语言字段均未提供时不改动。
     */
    private applyMultilingualInput;
    /** 合并单条 LocalizedText：当前值（对象取其已有键，纯字符串视为 zh）叠加 zh_Hans/en 覆盖。 */
    private mergeLocalized;
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
    /** 详情页可领券：binding.enabled && 模板 enabled && claimable + 渠道匹配（listByProduct 已过滤） */
    listProductCoupons(ctx: RequestContext, productId: ID): Promise<ProductCouponBinding[]>;
    /** 详情页领券：按 bindingId 找到模板后复用 claimCoupon（限领/余量/newCustomerOnly 校验都在其中） */
    claimProductCoupon(ctx: RequestContext, bindingId: ID): Promise<CustomerCoupon>;
    /** 凭码兑换：同租户内 claimCode 唯一匹配模板 → 复用 claimCoupon */
    redeemByClaimCode(ctx: RequestContext, claimCode: string): Promise<CustomerCoupon>;
    /** 模板渠道归属校验：channels 为空（不限渠道）→ true；否则要求包含当前渠道 */
    private templateBelongsToChannel;
    grantCoupon(ctx: RequestContext, templateId: ID, customerIds: ID[]): Promise<string[]>;
    listChannelCustomers(ctx: RequestContext, query?: string, take?: number, skip?: number): Promise<{
        items: Customer[];
        totalItems: number;
    }>;
    private customerInChannel;
    private notifyCouponIssued;
    grantCouponIssue(ctx: RequestContext, templateId: ID, customerIds: ID[], notify: boolean): Promise<Array<{
        customerId: ID;
        ok: boolean;
        code: string | null;
        reason: string | null;
    }>>;
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
    /** 新客判定：本租户是否已有历史有效订单（排除创建/购物车/待支付/修改/取消等未完成态） */
    private hasPlacedOrder;
    private createUserCoupon;
}
