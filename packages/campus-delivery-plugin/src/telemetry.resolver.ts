import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { CampusPermissions } from './permissions';
import { TelemetryService } from './telemetry.service';

/** C 端埋点 / 错误上报（匿名可用，按渠道隔离）。 */
@Resolver()
export class TelemetryShopResolver {
    constructor(private telemetry: TelemetryService) {}

    @Mutation()
    @Allow(Permission.Public)
    async campusTrackEvents(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<number> {
        return this.telemetry.trackEvents(ctx, input);
    }

    @Mutation()
    @Allow(Permission.Public)
    async campusReportError(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<boolean> {
        return this.telemetry.reportError(ctx, input);
    }
}

/** 后台「系统监控」：KPI / 近 7 日趋势 / Top 事件 / 埋点与错误明细。 */
@Resolver()
export class TelemetryAdminResolver {
    constructor(private telemetry: TelemetryService) {}

    @Query()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusTrackEventStats(@Ctx() ctx: RequestContext): Promise<any> {
        return this.telemetry.stats(ctx);
    }

    @Query()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusTrackEventList(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'eventName', type: () => String, nullable: true }) eventName?: string,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ): Promise<any> {
        return this.telemetry.events(ctx, { filter: eventName, skip, take });
    }

    @Query()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusErrorReportList(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'level', type: () => String, nullable: true }) level?: string,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ): Promise<any> {
        return this.telemetry.errors(ctx, { filter: level, skip, take });
    }
}
