import { ID, RequestContext } from '@vendure/core';
import { ChatService } from './chat.service';
/** 后台：在线客服 IM（会话列表 / 消息 / 回复 / 关闭 / 未读角标） */
export declare class ChatAdminResolver {
    private chat;
    constructor(chat: ChatService);
    campusChatConversations(ctx: RequestContext, status?: string, unreadOnly?: boolean, skip?: number, take?: number): Promise<{
        items: {
            customerName: string;
            customerPhone: string | null;
            channelId: ID;
            customerId: ID;
            orderCode: string | null;
            subject: string | null;
            status: string;
            lastMessage: string | null;
            lastMessageAt: Date | null;
            lastSenderType: string | null;
            unreadForCustomer: number;
            unreadForAdmin: number;
            closedAt: Date | null;
            id: ID;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
    }>;
    campusChatUnread(ctx: RequestContext): Promise<{
        conversationCount: number;
        messageCount: number;
    }>;
    campusAdminChatMessages(ctx: RequestContext, conversationId: ID, afterId?: ID, take?: number): Promise<import("./chat.entities").CampusChatMessage[]>;
    campusReplyChat(ctx: RequestContext, conversationId: ID, content?: string, images?: string[]): Promise<any>;
    campusCloseChatConversation(ctx: RequestContext, conversationId: ID): Promise<{
        status: string;
        channelId: ID;
        customerId: ID;
        orderCode: string | null;
        subject: string | null;
        lastMessage: string | null;
        lastMessageAt: Date | null;
        lastSenderType: string | null;
        unreadForCustomer: number;
        unreadForAdmin: number;
        closedAt: Date | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
