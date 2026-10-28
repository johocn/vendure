import { RequestContext } from '@vendure/core';
import { TelemetryService } from './telemetry.service';
/** C 端埋点 / 错误上报（匿名可用，按渠道隔离）。 */
export declare class TelemetryShopResolver {
    private telemetry;
    constructor(telemetry: TelemetryService);
    campusTrackEvents(ctx: RequestContext, input: any): Promise<number>;
    campusReportError(ctx: RequestContext, input: any): Promise<boolean>;
}
/** 后台「系统监控」：KPI / 近 7 日趋势 / Top 事件 / 埋点与错误明细。 */
export declare class TelemetryAdminResolver {
    private telemetry;
    constructor(telemetry: TelemetryService);
    campusTrackEventStats(ctx: RequestContext): Promise<any>;
    campusTrackEventList(ctx: RequestContext, eventName?: string, skip?: number, take?: number): Promise<any>;
    campusErrorReportList(ctx: RequestContext, level?: string, skip?: number, take?: number): Promise<any>;
}
