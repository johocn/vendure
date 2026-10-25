import { CustomerService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusRiderAppeal, CampusBlacklist, CampusSupportTicket } from './support.entities';
import { RiderCreditService } from './rider-credit.service';
export declare const TICKET_CATEGORIES: string[];
export declare const TICKET_STATUSES: string[];
export declare const APPEAL_STATUSES: string[];
/**
 * 客服工单 + 骑手申诉 + 下单黑名单（站内留言制，非实时 IM）。
 * C 端（shop-api）只操作自己的记录；后台（admin-api）按当前渠道隔离处理。
 */
export declare class SupportService {
    private connection;
    private customerService;
    private credit;
    constructor(connection: TransactionalConnection, customerService: CustomerService, credit: RiderCreditService);
    private requireCustomer;
    createTicket(ctx: RequestContext, input: {
        category: string;
        content: string;
        images?: string[] | null;
        orderCode?: string | null;
    }): Promise<any>;
    myTickets(ctx: RequestContext, skip?: number, take?: number): Promise<CampusSupportTicket[]>;
    adminTickets(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<{
        items: {
            customerName: string;
            customerPhone: string | null;
            channelId: ID;
            customerId: ID;
            orderCode: string | null;
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
        }[];
        total: number;
    }>;
    /** 运营回复（replied）/ 关闭（closed）；回复内容必填（关闭时可选沿用原回复） */
    replyTicket(ctx: RequestContext, id: ID, reply: string | undefined, status?: string): Promise<{
        status: string;
        reply: string | null;
        channelId: ID;
        customerId: ID;
        orderCode: string | null;
        category: string;
        content: string;
        images: string[] | null;
        repliedBy: string | null;
        repliedAt: Date | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createAppeal(ctx: RequestContext, input: {
        orderId?: ID | null;
        reason: string;
        images?: string[] | null;
    }): Promise<any>;
    myAppeals(ctx: RequestContext, skip?: number, take?: number): Promise<CampusRiderAppeal[]>;
    adminAppeals(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<{
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
    /** 审核申诉：通过则按 creditDelta 回补信用分（默认 10），拒绝不回补 */
    reviewAppeal(ctx: RequestContext, id: ID, approve: boolean, creditDelta?: number | null, note?: string | null): Promise<{
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
    listBlacklist(ctx: RequestContext, skip?: number, take?: number): Promise<{
        items: CampusBlacklist[];
        total: number;
    }>;
    addBlacklist(ctx: RequestContext, input: {
        type: string;
        value: string;
        reason?: string | null;
    }): Promise<any>;
    removeBlacklist(ctx: RequestContext, id: ID): Promise<{
        ok: boolean;
    }>;
}
