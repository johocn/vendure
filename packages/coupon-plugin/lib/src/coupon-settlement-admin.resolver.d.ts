import { ID, RequestContext } from '@vendure/core';
import { CouponSettlementService } from './coupon-settlement.service';
/**
 * 券结算单后台（admin-api，T1）：结算流水查询 + 手动触发汇总周期（运维）。
 * 权限对齐券商城后台（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
export declare class CouponSettlementAdminResolver {
    private settlementService;
    constructor(settlementService: CouponSettlementService);
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
}
