import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { SalesStatsService } from './sales-stats.service';
import { CampusPermissions } from './permissions';

@Resolver()
export class SalesStatsResolver {
    constructor(private stats: SalesStatsService) {}

    /** 销售侧经营 BI（P4-1）：今日/7日/30日或自定义 from/to 区间（按自然日，含首尾两天） */
    @Query()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusSalesStats(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'range', nullable: true }) range?: string,
        @Args({ name: 'from', nullable: true }) from?: string,
        @Args({ name: 'to', nullable: true }) to?: string,
    ) {
        return this.stats.stats(ctx, range, from, to);
    }
}
