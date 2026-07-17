import { RequestContext } from '@vendure/core';
import { MetricData } from '../service/metrics.service.js';
import { DashboardMetricSummaryEntry, DashboardMetricType } from '../types.js';
/**
 * Calculate your metric data based on the given input.
 * Be careful with heavy queries and calculations,
 * as this function is executed everytime a user views its dashboard
 *
 */
export interface MetricCalculation {
    type: DashboardMetricType;
    getTitle(ctx: RequestContext): string;
    calculateEntry(ctx: RequestContext, data: MetricData): DashboardMetricSummaryEntry;
}
export declare function getMonthName(monthNr: number): string;
/**
 * Calculates the average order value per month/week
 */
export declare class AverageOrderValueMetric implements MetricCalculation {
    readonly type = DashboardMetricType.AverageOrderValue;
    getTitle(ctx: RequestContext): string;
    calculateEntry(ctx: RequestContext, data: MetricData): DashboardMetricSummaryEntry;
}
/**
 * Calculates number of orders
 */
export declare class OrderCountMetric implements MetricCalculation {
    readonly type = DashboardMetricType.OrderCount;
    getTitle(ctx: RequestContext): string;
    calculateEntry(ctx: RequestContext, data: MetricData): DashboardMetricSummaryEntry;
}
/**
 * Calculates order total
 */
export declare class OrderTotalMetric implements MetricCalculation {
    readonly type = DashboardMetricType.OrderTotal;
    getTitle(ctx: RequestContext): string;
    calculateEntry(ctx: RequestContext, data: MetricData): DashboardMetricSummaryEntry;
}
