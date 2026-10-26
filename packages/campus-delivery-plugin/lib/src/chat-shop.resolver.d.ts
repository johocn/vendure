import { ID, RequestContext } from '@vendure/core';
import { ChatService } from './chat.service';
/** C 端：在线客服 IM（发起会话 / 会话列表 / 增量消息 / 发消息 / 已读 / 结束） */
export declare class ChatShopResolver {
    private chat;
    constructor(chat: ChatService);
    campusStartChat(ctx: RequestContext, orderCode?: string, subject?: string): Promise<any>;
    campusMyChatConversations(ctx: RequestContext, skip?: number, take?: number): Promise<import("./chat.entities").CampusChatConversation[]>;
    campusChatMessages(ctx: RequestContext, conversationId: ID, afterId?: ID, take?: number): Promise<import("./chat.entities").CampusChatMessage[]>;
    campusSendChatMessage(ctx: RequestContext, conversationId: ID, content?: string, images?: string[]): Promise<any>;
    campusMarkChatRead(ctx: RequestContext, conversationId: ID): Promise<{
        unreadForCustomer: number;
        channelId: ID;
        customerId: ID;
        orderCode: string | null;
        subject: string | null;
        status: string;
        lastMessage: string | null;
        lastMessageAt: Date | null;
        lastSenderType: string | null;
        unreadForAdmin: number;
        closedAt: Date | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    campusCloseChat(ctx: RequestContext, conversationId: ID): Promise<{
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
