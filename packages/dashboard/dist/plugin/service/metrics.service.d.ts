import { CacheService, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { MetricCalculation } from '../config/metrics-strategies.js';
import { DashboardMetricSummary, DashboardMetricSummaryInput } from '../types.js';
export type MetricData = {
    date: Date;
    orders: Order[];
};
export declare class MetricsService {
    private connection;
    private cacheService;
    metricCalculations: MetricCalculation[];
    constructor(connection: TransactionalConnection, cacheService: CacheService);
    getMetrics(ctx: RequestContext, { types, refresh, startDate, endDate }: DashboardMetricSummaryInput): Promise<DashboardMetricSummary[]>;
    loadData(ctx: RequestContext, startDate: Date, endDate: Date): Promise<Map<string, MetricData>>;
}
