import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { DeliveryStatsService } from './delivery-stats.service';
import { CampusPermissions } from './permissions';

@Resolver()
export class DeliveryStatsResolver {
    constructor(private stats: DeliveryStatsService) {}

    /** 配送数据看板（方案 A）：today/7d/30d 三档窗口，KPI+趋势+环节+归因+店铺对比 */
    @Query()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusDeliveryStats(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'range', nullable: true }) range?: string,
    ) {
        return this.stats.stats(ctx, range);
    }
}
