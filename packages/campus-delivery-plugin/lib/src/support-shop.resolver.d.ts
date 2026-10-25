import { ID, RequestContext } from '@vendure/core';
import { RiderOpsService } from './rider-ops.service';
import { SupportService } from './support.service';
/** C 端：客服工单 / 骑手申诉 / 骑手评分 / 我的班次 / 配送导航 */
export declare class SupportShopResolver {
    private support;
    private riderOps;
    constructor(support: SupportService, riderOps: RiderOpsService);
    campusMySupportTickets(ctx: RequestContext, skip?: number, take?: number): Promise<import("./support.entities").CampusSupportTicket[]>;
    campusCreateSupportTicket(ctx: RequestContext, category: string, content: string, images?: string[], orderCode?: string): Promise<any>;
    campusMyRiderAppeals(ctx: RequestContext, skip?: number, take?: number): Promise<import("./support.entities").CampusRiderAppeal[]>;
    campusCreateRiderAppeal(ctx: RequestContext, reason: string, orderId?: ID, images?: string[]): Promise<any>;
    campusMyRiderRating(ctx: RequestContext): Promise<{
        riderCustomerId: number;
        avgRating: number;
        ratingCount: number;
    }>;
    /** 骑手自己的评价明细（P3-3）：均分之外的逐条评分/标签/留言 */
    campusMyRiderReviews(ctx: RequestContext, skip?: number, take?: number): Promise<import("./rider-ops.entities").CampusRiderReview[]>;
    campusRateRider(ctx: RequestContext, orderId: ID, rating: number, tags?: string[], comment?: string): Promise<{
        ok: boolean;
        rating: any;
    }>;
    campusMyShifts(ctx: RequestContext, from?: string, to?: string): Promise<import("./rider-ops.entities").CampusRiderShift[]>;
    campusRiderNav(ctx: RequestContext, orderId: ID): Promise<{
        orderId: ID;
        orderCode: string;
        storeName: string;
        storeAddress: string | null;
        storePhone: string | null;
        storeLat: number | null;
        storeLng: number | null;
        buildingName: string | null;
        buildingDetail: any;
        buildingLat: number | null;
        buildingLng: number | null;
        campusZone: any;
        note: any;
        deliveryStatus: any;
    }>;
}
