import { ID, RequestContext } from '@vendure/core';
import { RiderLedgerService } from './rider-ledger.service';
/** 骑手财务/轨迹只读查询（P8-4）：
 * 分成台账属财务对账 → CampusAuditRider；轨迹属调度追溯 → CampusViewDispatch。 */
export declare class RiderLedgerAdminResolver {
    private ledger;
    constructor(ledger: RiderLedgerService);
    campusRiderEarnings(ctx: RequestContext, from?: string, to?: string, riderCustomerId?: string, status?: string, orderCode?: string, skip?: number, take?: number): Promise<{
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
    campusOrderRiderTrack(ctx: RequestContext, orderId?: ID, orderCode?: string): Promise<{
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
    campusRiderTrack(ctx: RequestContext, riderCustomerId: ID, from: string, to: string): Promise<{
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
}
