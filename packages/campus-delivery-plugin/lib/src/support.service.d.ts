import { CustomerService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusRiderAppeal, CampusBlacklist, CampusSupportTicket } from './support.entities';
import { RiderCreditService } from './rider-credit.service';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
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
    private feishu;
    constructor(connection: TransactionalConnection, customerService: CustomerService, credit: RiderCreditService, feishu: FeishuNotifyService);
    private requireCustomer;
    /** 飞书提醒：仅记录日志、绝不阻塞主流程（未启用时 pushEvent 直接返回 true） */
    private pushFeishu;
    /**
     * 站内信：复用 message-plugin 的 Message/MessageDelivery（invoice-plugin / coupon-plugin 已落地范式）；
     * 未装 message-plugin 时实体不存在，静默跳过，绝不阻塞工单/申诉主流程。
     */
    private sendInAppMessage;
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
    /**
     * 批量导入黑名单（P3-2）：type=phone 时 values 为手机号列表；type=user 时为用户 ID 列表。
     * 去重后逐条入库；已存在且生效的计入 skipped，格式非法/不属于本店铺的计入 invalid。
     * 单次上限 500 条，避免一次性长事务。
     */
    importBlacklist(ctx: RequestContext, type: string, values: string[], reason?: string | null): Promise<{
        added: number;
        skipped: number;
        invalid: number;
    }>;
    removeBlacklist(ctx: RequestContext, id: ID): Promise<{
        ok: boolean;
    }>;
}
