import { CacheService, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { MetricCalculation } from '../config/metrics-strategies';
import { MetricInterval, MetricSummary, MetricSummaryInput } from '../types';
export type MetricData = {
    date: Date;
    orders: Order[];
};
export declare class MetricsService {
    private connection;
    private cacheService;
    metricCalculations: MetricCalculation[];
    constructor(connection: TransactionalConnection, cacheService: CacheService);
    getMetrics(ctx: RequestContext, { interval, types, refresh }: MetricSummaryInput): Promise<MetricSummary[]>;
    loadData(ctx: RequestContext, interval: MetricInterval, endDate: Date): Promise<Map<number, MetricData>>;
}
