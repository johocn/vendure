import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { SalesStatsService } from './sales-stats.service';
import { CampusPermissions } from './permissions';

@Resolver()
export class SalesStatsResolver {
    constructor(private stats: SalesStatsService) {}

    /** 销售侧经营 BI（P4-1）：今日/7日/30日，KPI+环比+时段热力+菜品四象限+复购分群 */
    @Query()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusSalesStats(@Ctx() ctx: RequestContext, @Args({ name: 'range', nullable: true }) range?: string) {
        return this.stats.stats(ctx, range);
    }
}
