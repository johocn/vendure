import { RequestContext, TransactionalConnection } from '@vendure/core';
export type StatsRange = 'today' | '7d' | '30d';
export interface StatsOrderLike {
    id: unknown;
    code: string;
    state: string;
    createdAt: Date | string;
    channels?: Array<{
        id: unknown;
        code: string;
    }>;
    customFields: {
        promisedAt?: Date | string | null;
        assignedAt?: Date | string | null;
        deliveredAt?: Date | string | null;
        scheduledFor?: Date | string | null;
        timeoutCompensatedAt?: Date | string | null;
        timeoutAttribution?: string | null;
    };
}
export interface StatsKpi {
    totalOrders: number;
    onTimeRate: number;
    avgDeliveryMinutes: number;
    timeoutCompensated: number;
}
export interface StatsDailyPoint {
    date: string;
    orders: number;
    onTimeRate: number;
}
export interface StatsStage {
    key: 'assign' | 'transit';
    label: string;
    avgMinutes: number;
}
export interface StatsAttribution {
    merchant: number;
    rider: number;
    platform: number;
}
export interface StatsStoreLine {
    channelId: string;
    channelName: string;
    orders: number;
    onTimeRate: number;
}
export interface DeliveryStatsPayload {
    range: StatsRange;
    windowStart: Date;
    kpis: StatsKpi;
    dailyTrend: StatsDailyPoint[];
    stages: StatsStage[];
    attribution: StatsAttribution;
    storeComparison: StatsStoreLine[];
}
export declare function normalizeRange(v?: string | null): StatsRange;
/** 窗口起点：today=校园时区（UTC+8）0 点；7d/30d=滚动窗口 */
export declare function windowStartOf(range: StatsRange, now: number): number;
/** 纯函数聚合（单测注入时间/数据）。
 * 口径：单量=窗口内未取消订单；准点率=deliveredAt ≤ promisedAt + 各渠道 grace（有承诺且已送达才计分）；
 * 平均送达/在途段=assignedAt→deliveredAt；接单段=createdAt→assignedAt；
 * 赔付=窗口内 timeoutCompensatedAt 非空单，按 timeoutAttribution 归因分桶；
 * 店铺对比=按渠道分组（排除平台默认渠道）。 */
export declare function aggregateStats(args: {
    orders: StatsOrderLike[];
    graceByChannel: Map<number, number>;
    windowStart: number;
    now: number;
    range: StatsRange;
}): DeliveryStatsPayload;
export declare class DeliveryStatsService {
    private connection;
    constructor(connection: TransactionalConnection);
    stats(ctx: RequestContext, rangeInput?: string | null): Promise<DeliveryStatsPayload>;
}
