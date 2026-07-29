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
    private countCouponByStatus;
}
