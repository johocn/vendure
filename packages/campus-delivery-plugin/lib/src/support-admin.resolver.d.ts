import { ID, RequestContext } from '@vendure/core';
import { RiderOpsService } from './rider-ops.service';
import { SupportService } from './support.service';
/** 运营侧：客服工单 / 骑手申诉 / 黑名单 / 排班 / 在线时长 / 评分查询 */
export declare class SupportAdminResolver {
    private support;
    private riderOps;
    constructor(support: SupportService, riderOps: RiderOpsService);
    campusSupportTickets(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<{
        items: ({
            customerName: string;
            customerPhone: string | null;
            afterSalesRequestId: number | null;
            afterSalesState: null;
            afterSalesType: null;
            afterSalesRefundAmount: null;
            afterSalesActualRefundAmount: null;
            channelId: ID;
            customerId: number | null;
            orderCode: string | null;
            orderId: number | null;
            source: string;
            dedupeKey: string | null;
            category: string;
            content: string;
            images: string[] | null;
            status: string;
            reply: string | null;
            repliedBy: string | null;
            repliedAt: Date | null;
            id: ID;
            createdAt: Date;
            updatedAt: Date;
        } | {
            customerName: string;
            customerPhone: string | null;
            afterSalesRequestId: number | null;
            afterSalesState: any;
            afterSalesType: any;
            afterSalesRefundAmount: number | null;
            afterSalesActualRefundAmount: number | null;
            channelId: ID;
            customerId: number | null;
            orderCode: string | null;
            orderId: number | null;
            source: string;
            dedupeKey: string | null;
            category: string;
            content: string;
            images: string[] | null;
            status: string;
            reply: string | null;
            repliedBy: string | null;
            repliedAt: Date | null;
            id: ID;
            createdAt: Date;
            updatedAt: Date;
        })[];
        total: number;
    }>;
    campusReplySupportTicket(ctx: RequestContext, id: ID, reply?: string, status?: string): Promise<{
        status: string;
        reply: string | null;
        channelId: ID;
        customerId: number | null;
        orderCode: string | null;
        orderId: number | null;
        afterSalesRequestId: number | null;
        source: string;
        dedupeKey: string | null;
        category: string;
        content: string;
        images: string[] | null;
        repliedBy: string | null;
        repliedAt: Date | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    campusLinkSupportTicketAfterSales(ctx: RequestContext, id: ID, afterSalesRequestId: ID): Promise<{
        afterSalesRequestId: number | null;
        afterSalesState: null;
        afterSalesType: null;
        afterSalesRefundAmount: null;
        afterSalesActualRefundAmount: null;
        channelId: ID;
        customerId: number | null;
        orderCode: string | null;
        orderId: number | null;
        source: string;
        dedupeKey: string | null;
        category: string;
        content: string;
        images: string[] | null;
        status: string;
        reply: string | null;
        repliedBy: string | null;
        repliedAt: Date | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    } | {
        afterSalesRequestId: number | null;
        afterSalesState: any;
        afterSalesType: any;
        afterSalesRefundAmount: number | null;
        afterSalesActualRefundAmount: number | null;
        channelId: ID;
        customerId: number | null;
        orderCode: string | null;
        orderId: number | null;
        source: string;
        dedupeKey: string | null;
        category: string;
        content: string;
        images: string[] | null;
        status: string;
        reply: string | null;
        repliedBy: string | null;
        repliedAt: Date | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    campusRiderAppeals(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<{
        items: {
            riderName: any;
            riderPhone: string | null;
            channelId: ID;
            riderCustomerId: ID;
            orderId: number | null;
            orderCode: string | null;
            reason: string;
            images: string[] | null;
            status: string;
            creditDelta: number;
            reviewNote: string | null;
            reviewedBy: string | null;
            reviewedAt: Date | null;
            id: ID;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
    }>;
    campusReviewRiderAppeal(ctx: RequestContext, id: ID, approve: boolean, creditDelta?: number, note?: string): Promise<{
        status: string;
        creditDelta: number;
        channelId: ID;
        riderCustomerId: ID;
        orderId: number | null;
        orderCode: string | null;
        reason: string;
        images: string[] | null;
        reviewNote: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    campusBlacklist(ctx: RequestContext, skip?: number, take?: number): Promise<{
        items: import("./support.entities").CampusBlacklist[];
        total: number;
    }>;
    campusAddBlacklist(ctx: RequestContext, type: string, value: string, reason?: string): Promise<any>;
    campusImportBlacklist(ctx: RequestContext, type: string, values: string[], reason?: string): Promise<{
        added: number;
        skipped: number;
        invalid: number;
    }>;
    campusRemoveBlacklist(ctx: RequestContext, id: ID): Promise<{
        ok: boolean;
    }>;
    campusRiderShifts(ctx: RequestContext, date: string): Promise<{
        date: string;
        items: {
            realName: any;
            onlineMinutes: number;
            shiftMinutes: number;
            channelId: ID;
            riderCustomerId: ID;
            shiftDate: string;
            startTime: string;
            endTime: string;
            note: string | null;
            id: ID;
            createdAt: Date;
            updatedAt: Date;
        }[];
    }>;
    campusSaveRiderShift(ctx: RequestContext, input: any): Promise<any>;
    campusDeleteRiderShift(ctx: RequestContext, id: ID): Promise<{
        ok: boolean;
    }>;
    campusRiderOnlineStats(ctx: RequestContext, date?: string): Promise<{
        date: string;
        items: {
            riderCustomerId: number;
            realName: any;
            onlineMinutes: number;
        }[];
    }>;
    campusRiderReviews(ctx: RequestContext, riderCustomerId?: ID, skip?: number, take?: number): Promise<import("./rider-ops.entities").CampusRiderReview[]>;
    campusRiderRating(ctx: RequestContext, riderCustomerId: ID): Promise<{
        riderCustomerId: number;
        avgRating: number;
        ratingCount: number;
    }>;
}
