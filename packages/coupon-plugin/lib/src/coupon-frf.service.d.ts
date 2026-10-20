import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { CouponDailyClaimView, CouponFlashSaleView } from './coupon-frf';
/** C 端每日领券条目视图：模板 + 今日是否已领 + 是否售罄 */
export interface DailyClaimItemView {
    template: CouponTemplate;
    claimedToday: boolean;
    soldOut: boolean;
}
export interface DailyClaimActivityView extends Omit<CouponDailyClaimView<CouponTemplate>, 'templates'> {
    items: DailyClaimItemView[];
}
/** C 端神券日条目视图：模板 + 是否售罄 + 本场次我已抢张数 */
export interface FlashSaleItemView {
    template: CouponTemplate;
    soldOut: boolean;
    myClaimed: number;
}
export interface FlashSaleActivityView extends Omit<CouponFlashSaleView<CouponTemplate>, 'templates'> {
    items: FlashSaleItemView[];
}
export interface FrfClaimResult {
    status: string;
    coupon: CustomerCoupon | null;
}
/**
 * FR-F 服务：每日领券（F1）/ 神券日限量抢（F2）/ 支付有礼（F3）。
 * 复用 P1 机制：R2 原子限量（issueForProgram）、R3 幂等（唯一索引 + 同事务）、R4 防骚扰（冷却去重）、
 * R1 issuedBy 留痕（DAILY / FLASH / PAYGIFT）、R5 渠道隔离（配置按 ctx.channelId 读取）。
 */
export declare class CouponFrFService {
    private connection;
    private couponService;
    constructor(connection: TransactionalConnection, couponService: CouponService);
    /** 渠道 customFields 中指定配置原文 */
    private loadRawConfig;
    /** 当前请求 customerId（匿名 null） */
    private currentCustomerId;
    /** 模板归属校验（与裂变同口径）：enabled 且渠道含本渠道 */
    private isOwn;
    /** 每日领券活动视图（匿名可查；claimedToday 仅登录态计算） */
    dailyClaimActivity(ctx: RequestContext): Promise<DailyClaimActivityView | null>;
    /** 每日领券（登录）：每人每券每天 1 张（UTC+8 业务日），R3 幂等 = 唯一索引 + 同事务。 */
    claimDaily(ctx: RequestContext, templateId: number): Promise<FrfClaimResult>;
    /** 神券日活动视图（匿名可查；myClaimed 仅登录态计算） */
    flashSaleActivity(ctx: RequestContext): Promise<FlashSaleActivityView | null>;
    /** 场次窗内 FLASH 发券计数（按模板分组） */
    private countFlashClaims;
    /** 神券日抢券（登录）：时间窗硬拦 + 场次内限抢 + R2 原子限量（超发不可能）。 */
    claimFlash(ctx: RequestContext, templateId: number): Promise<FrfClaimResult>;
    /**
     * 支付有礼（FR-F3）：订单 PaymentSettled 事件回调。
     * 静默原则（C4）：任何不满足/失败都只留日志、绝不抛错阻塞支付流程。
     * 幂等：cooldownDays ≥ 1 冷却去重（R4）+ issueForProgram 原子扣量，重复事件不会重复发券。
     */
    payGiftOnOrderSettled(ctx: RequestContext, order: Order): Promise<void>;
}
