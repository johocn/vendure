import { RequestContext } from '@vendure/core';
import { MetricsService } from '../service/metrics.service.js';
import { DashboardMetricSummary, DashboardMetricSummaryInput } from '../types.js';
export declare class MetricsResolver {
    private service;
    constructor(service: MetricsService);
    dashboardMetricSummary(ctx: RequestContext, input: DashboardMetricSummaryInput): Promise<DashboardMetricSummary[]>;
}
