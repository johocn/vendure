import { ModuleRef } from '@nestjs/core';
import { ID, PaginatedList, ProductService, RequestContext, TransactionalConnection } from '@vendure/core';
import { Review } from './review.entity';
import { ReviewAlert } from './review-alert.entity';
export interface ReviewAlertRuleLike {
    channelId: number;
    enabled: boolean;
    maxRating: number;
    couponTemplateId: string | null;
}
export interface UpdateReviewAlertRuleInput {
    enabled?: boolean;
    maxRating?: number;
    couponTemplateId?: ID | null;
}
export interface ReviewAlertListOptions {
    skip?: number;
    take?: number;
    status?: string;
}
export interface ReviewAlertStats {
    newCount: number;
    totalCount: number;
    compensatedCount: number;
    /** 近 7 日差评预警数（列表页副标题用） */
    last7dCount: number;
}
/**
 * P4-2 评价品质闭环：
 * 规则读写 → 差评落库即预警（星级触阈 或 正文命中严重项）→ 自动致歉券 → 后台回评/关闭。
 * 任何一步失败都不阻断评价主流程（仅告警 + 落 note，后台可重试）。
 */
export declare class ReviewAlertService {
    private connection;
    private productService;
    private moduleRef?;
    constructor(connection: TransactionalConnection, productService: ProductService, moduleRef?: ModuleRef | undefined);
    /** vendure Injector 由 ModuleRef 惰性构造（跨模块解析 Coupon 服务，避免循环依赖） */
    private get injector();
    /** 渠道规则（未配置返回默认：启用 + 2 星 + 不发券，不落库）。 */
    getRule(ctx: RequestContext): Promise<ReviewAlertRuleLike>;
    /** 更新渠道规则（不存在则创建）。 */
    updateRule(ctx: RequestContext, input: UpdateReviewAlertRuleInput): Promise<ReviewAlertRuleLike>;
    /**
     * 评价落库后调用：命中规则则建预警并尝试自动发致歉券（幂等，同一评价仅一条预警）。
     * 返回 null 表示未命中规则。
     */
    recordFromReview(ctx: RequestContext, review: Review): Promise<ReviewAlert | null>;
    getAlerts(ctx: RequestContext, options?: ReviewAlertListOptions): Promise<PaginatedList<ReviewAlert>>;
    getAlert(ctx: RequestContext, id: ID): Promise<ReviewAlert>;
    getStats(ctx: RequestContext): Promise<ReviewAlertStats>;
    /** 一键回评：写回评价正文回复，预警转「已回评」。 */
    replyAlert(ctx: RequestContext, id: ID, reply: string): Promise<ReviewAlert>;
    /** 重发/补发致歉券（规则未配券模板时拒绝）。 */
    resendCoupon(ctx: RequestContext, id: ID): Promise<ReviewAlert>;
    /** 关闭预警（赔礼/线下已沟通等），仅留处置备注。 */
    closeAlert(ctx: RequestContext, id: ID, note?: string | null): Promise<ReviewAlert>;
    /** 预警卡片展示的商品名（本地化，取不到返回 null）。 */
    getProductName(ctx: RequestContext, alert: ReviewAlert): Promise<string | null>;
    private grantApologyCoupon;
}
