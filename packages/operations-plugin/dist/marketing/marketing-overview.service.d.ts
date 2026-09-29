import { RequestContext, TransactionalConnection } from '@vendure/core';
export interface MarketingOverview {
    flashSale: {
        active: number;
        upcoming: number;
        ended: number;
    };
    groupBuy: {
        active: number;
        upcoming: number;
        ended: number;
    };
    coupon: {
        active: number;
        upcoming: number;
        ended: number;
    };
}
export declare class MarketingOverviewService {
    private connection;
    constructor(connection: TransactionalConnection);
    private assertPermission;
    getOverview(ctx: RequestContext): Promise<MarketingOverview>;
    private countByStatus;
    /**
     * 券数量按状态统计。
     *
     * 注（2026-09-30）：coupon-plugin 在 2026-09-19 重构后**已不存在 `Coupon` 实体**
     * （改为 `CouponTemplate` + `CustomerCoupon`），旧实现 `getRepository(ctx, 'Coupon')`
     * 的报错被外层 try/catch 吞掉，导致券数量恒为 0/0/0。这里改用 `CouponTemplate`
     * （字段 `enabled` / `startsAt` / `endsAt`，两者均可为空 = 长期有效）。
     */
    private countCouponByStatus;
}
