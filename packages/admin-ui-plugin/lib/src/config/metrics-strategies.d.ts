import { RequestContext } from '@vendure/core';
import { MetricData } from '../service/metrics.service';
import { MetricInterval, MetricSummaryEntry, MetricType } from '../types';
/**
 * Calculate your metric data based on the given input.
 * Be careful with heavy queries and calculations,
 * as this function is executed everytime a user views its dashboard
 *
 */
export interface MetricCalculation {
    type: MetricType;
    getTitle(ctx: RequestContext): string;
    calculateEntry(ctx: RequestContext, interval: MetricInterval, data: MetricData): MetricSummaryEntry;
}
export declare function getMonthName(monthNr: number): string;
/**
 * Calculates the average order value per month/week
 */
export declare class AverageOrderValueMetric implements MetricCalculation {
    readonly type = MetricType.AverageOrderValue;
    getTitle(ctx: RequestContext): string;
    calculateEntry(ctx: RequestContext, interval: MetricInterval, data: MetricData): MetricSummaryEntry;
}
/**
 * Calculates number of orders
 */
export declare class OrderCountMetric implements MetricCalculation {
    readonly type = MetricType.OrderCount;
    getTitle(ctx: RequestContext): string;
    calculateEntry(ctx: RequestContext, interval: MetricInterval, data: MetricData): MetricSummaryEntry;
}
/**
 * Calculates order total
 */
export declare class OrderTotalMetric implements MetricCalculation {
    readonly type = MetricType.OrderTotal;
    getTitle(ctx: RequestContext): string;
    calculateEntry(ctx: RequestContext, interval: MetricInterval, data: MetricData): MetricSummaryEntry;
}
