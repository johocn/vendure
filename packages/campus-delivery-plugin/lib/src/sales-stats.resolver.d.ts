import { RequestContext } from '@vendure/core';
import { SalesStatsService } from './sales-stats.service';
export declare class SalesStatsResolver {
    private stats;
    constructor(stats: SalesStatsService);
    /** 销售侧经营 BI（P4-1）：今日/7日/30日，KPI+环比+时段热力+菜品四象限+复购分群 */
    campusSalesStats(ctx: RequestContext, range?: string): Promise<import("./sales-stats.service").SalesStatsPayload>;
}
