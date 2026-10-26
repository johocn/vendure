import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/**
 * 在线客服会话（P0-3）：顾客 ↔ 平台/商家的实时 IM 会话。
 * 表已由 p8-p0-privacy-food-safety 迁移建好，环境 synchronize:false，实体只做读写映射。
 */
export declare class CampusChatConversation extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    customerId: ID;
    /** 关联订单（可选）：订单详情「联系客服」发起时带上 */
    orderCode: string | null;
    /** 会话标题（可选，缺省由订单号/顾客名兜底） */
    subject: string | null;
    /** open / closed */
    status: string;
    /** 最后一条消息摘要（列表页直接展示，避免 N+1 拉消息） */
    lastMessage: string | null;
    lastMessageAt: Date | null;
    /** 最后一条消息的发件方：customer / admin */
    lastSenderType: string | null;
    unreadForCustomer: number;
    unreadForAdmin: number;
    closedAt: Date | null;
    constructor(input?: DeepPartial<CampusChatConversation>);
}
/** 会话消息：senderType=customer/admin（商家与平台运营共用 admin 侧） */
export declare class CampusChatMessage extends VendureEntity {
    [key: string]: any;
    conversationId: ID;
    senderType: string;
    /** 发件人（admin 侧为后台用户 id，顾客侧为 customer id） */
    senderId: number | null;
    content: string | null;
    /** 图片 URL 列表（simple-array，逗号分隔） */
    images: string[] | null;
    readAt: Date | null;
    constructor(input?: DeepPartial<CampusChatMessage>);
}
