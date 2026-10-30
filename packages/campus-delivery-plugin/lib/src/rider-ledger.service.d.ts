import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
export interface RiderEarningQuery {
    from?: string;
    to?: string;
    riderCustomerId?: ID;
    status?: string;
    orderCode?: string;
    skip?: number;
    take?: number;
}
export declare class RiderLedgerService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 分成台账：按渠道 + 日期/骑手/状态/订单号筛选，返回当前页与全量合计（金额单位分） */
    earningsLedger(ctx: RequestContext, input: RiderEarningQuery): Promise<{
        items: {
            id: string;
            orderId: string;
            orderCode: any;
            riderCustomerId: string;
            riderName: string;
            amount: number;
            tip: number;
            status: string;
            createdAt: any;
        }[];
        total: number;
        sumAmount: number;
        sumTip: number;
    }>;
    /** 订单维度轨迹：传订单 ID 或订单号（#A1024）均可，单趟配送完整点位（升序） */
    orderTrack(ctx: RequestContext, orderId?: ID, orderCode?: string): Promise<{
        orderId: string;
    } & {
        riderCustomerId: string;
        orderCode: any;
        points: {
            id: string;
            orderId: string;
            orderCode: any;
            riderCustomerId: string;
            lat: number;
            lng: number;
            reportedAt: any;
        }[];
        distanceMeters: number;
        truncated: boolean;
    }>;
    /** 骑手时段轨迹：骑手 + 东八区自然日区间（含结束日）跨单点位，按时间升序 */
    riderTrack(ctx: RequestContext, riderCustomerId: ID, from: string, to: string): Promise<{
        riderName: string;
        riderCustomerId: string;
        orderCode: any;
        points: {
            id: string;
            orderId: string;
            orderCode: any;
            riderCustomerId: string;
            lat: number;
            lng: number;
            reportedAt: any;
        }[];
        distanceMeters: number;
        truncated: boolean;
    }>;
    private toTrack;
    private riderNames;
}
