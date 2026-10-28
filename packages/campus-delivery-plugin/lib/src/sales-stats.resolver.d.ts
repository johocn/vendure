import { RequestContext } from '@vendure/core';
import { SalesStatsService } from './sales-stats.service';
export declare class SalesStatsResolver {
    private stats;
    constructor(stats: SalesStatsService);
    /** 销售侧经营 BI（P4-1）：今日/7日/30日或自定义 from/to 区间（按自然日，含首尾两天） */
    campusSalesStats(ctx: RequestContext, range?: string, from?: string, to?: string): Promise<import("./sales-stats.service").SalesStatsPayload>;
}
