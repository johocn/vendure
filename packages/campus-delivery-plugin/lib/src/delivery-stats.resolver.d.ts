import { RequestContext } from '@vendure/core';
import { DeliveryStatsService } from './delivery-stats.service';
export declare class DeliveryStatsResolver {
    private stats;
    constructor(stats: DeliveryStatsService);
    /** 配送数据看板（方案 A）：today/7d/30d 三档窗口，KPI+趋势+环节+归因+店铺对比 */
    campusDeliveryStats(ctx: RequestContext, range?: string): Promise<import("./delivery-stats.service").DeliveryStatsPayload>;
}
