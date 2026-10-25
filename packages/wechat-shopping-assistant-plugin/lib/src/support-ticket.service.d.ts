import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CredentialService } from './credential.service';
import { WechatSupportTicket } from './entities/wechat-support-ticket.entity';
import { WechatSender } from './wechat-sender';
export interface CreateSupportTicketInput {
    openid: string;
    channelId: number;
    customerId?: number | null;
    storeId?: string | null;
    storeName?: string | null;
    summary?: string | null;
    content: string;
}
/** 留言工单：落库 + 后台列表 + 后台回复（客服消息下发到用户） */
export declare class SupportTicketService {
    private connection;
    private sender;
    private credentialService;
    constructor(connection: TransactionalConnection, sender: WechatSender, credentialService: CredentialService);
    create(ctx: RequestContext, input: CreateSupportTicketInput): Promise<WechatSupportTicket>;
    /** 后台工单列表（按创建时间倒序；status 可筛选 open/replied） */
    list(ctx: RequestContext, options?: {
        limit?: number;
        status?: string;
    }): Promise<WechatSupportTicket[]>;
    /**
     * 后台回复：先经公众号客服消息下发，成功后再落库（48 小时窗口外的发送失败会直接报给运营，
     * 由运营改用电话联系，避免「后台显示已回复但用户没收到」）。
     */
    reply(ctx: RequestContext, id: string | number, content: string): Promise<WechatSupportTicket>;
}
