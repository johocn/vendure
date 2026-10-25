import { RequestContext } from '@vendure/core';
import { WechatSupportTicket } from './entities/wechat-support-ticket.entity';
import { SupportTicketService } from './support-ticket.service';
/** 留言工单后台接口：列表 + 回复（回复经公众号客服消息下发到用户） */
export declare class SupportTicketAdminResolver {
    private supportTickets;
    constructor(supportTickets: SupportTicketService);
    wechatSupportTickets(ctx: RequestContext, limit?: number, status?: string): Promise<WechatSupportTicket[]>;
    replyWechatSupportTicket(ctx: RequestContext, id: string, content: string): Promise<WechatSupportTicket>;
}
