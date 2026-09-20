import { RequestContext } from '@vendure/core';
import { ReportService } from '../services/report.service';
/**
 * 报表查询 API（店长/老板维度）。
 *
 * 权限：复用 Vendure 原生 ReadOrder Permission（店长/老板角色默认拥有）。
 * 数据范围：ctx.channelId 自动过滤，仅返回当前 channel 数据。
 *
 * 四类报表对应四个 Query：
 * - todayOverview: 今日概览（实时）
 * - posSalesReport: 日/区间报表（按天趋势）—— 命名为 pos 前缀，避免与 sales-plugin 的 salesReport 重名冲突
 * - monthlyReport: 月度报表（含环比）
 * - topProducts: 商品销量 TOP
 */
export declare class AdminReportResolver {
    private reportService;
    constructor(reportService: ReportService);
    todayOverview(ctx: RequestContext): Promise<import("../services/report.service").TodayOverview>;
    posSalesReport(ctx: RequestContext, startDate: string, endDate: string): Promise<import("../services/report.service").SalesReport>;
    monthlyReport(ctx: RequestContext, year: number, month: number): Promise<import("../services/report.service").MonthlyReport>;
    topProducts(ctx: RequestContext, startDate: string, endDate: string, limit?: number, sortBy?: 'quantity' | 'amount'): Promise<import("../services/report.service").TopProductReport>;
}
