import { ID, RequestContext } from '@vendure/core';
import { CouponSettlementReconcileService } from './coupon-settlement-reconcile.service';
import { CouponSettlementService } from './coupon-settlement.service';
/**
 * 券结算单后台（admin-api，T1 结算流水 + T5 对账）：查询 + 手动触发（运维）。
 * 权限对齐券商城后台（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
export declare class CouponSettlementAdminResolver {
    private settlementService;
    private reconcileService;
    constructor(settlementService: CouponSettlementService, reconcileService: CouponSettlementReconcileService);
    couponSettlementOrders(ctx: RequestContext, options?: any): Promise<{
        items: import("./coupon-settlement-order.entity").CouponSettlementOrder[];
        totalItems: number;
    }>;
    couponSettlementOrder(ctx: RequestContext, id: ID): Promise<import("./coupon-settlement-order.entity").CouponSettlementOrder | undefined>;
    /** 手动触发 T+1 汇总周期（补登 → 提交分账 → 回执推进），运维排查用 */
    runCouponSettlementCycle(ctx: RequestContext): Promise<{
        submitted: number;
        promoted: number;
        failed: number;
    }>;
    /** 结算汇总（T11 看板口径 = 结算单聚合；渠道隔离） */
    couponSettlementSummary(ctx: RequestContext): Promise<{
        total: number;
        pending: number;
        settled: number;
        paidOut: number;
        reversed: number;
        cancelled: number;
        totalFace: number;
        totalCommission: number;
        totalNet: number;
    }>;
    /** 分账配置态（T9 进件状态页）：分账模式 + 进件状态（COUPON_SPLIT_ONBOARDING_STATUS，微信实联前为运营人工维护） */
    couponSplitConfig(_ctx: RequestContext): Promise<{
        splitMode: "stub" | "wechat" | "unknown";
        onboardingStatus: string;
    }>;
    /** 台账页差异查询（默认只看未解决差异） */
    couponReconcileDiffs(ctx: RequestContext, options?: any): Promise<{
        items: import("./coupon-settlement-reconcile-diff.entity").CouponSettlementReconcileDiff[];
        totalItems: number;
    }>;
    /** 手动跑一轮对账（结算单 ↔ 分账回单 ↔ 商户核销流水） */
    runCouponReconcile(ctx: RequestContext): Promise<{
        runId: string;
        checked: number;
        diffs: number;
        high: number;
        medium: number;
        low: number;
    }>;
    /** 标记差异已处理（保留审计） */
    resolveCouponReconcileDiff(ctx: RequestContext, id: ID, remark?: string): Promise<boolean>;
}
