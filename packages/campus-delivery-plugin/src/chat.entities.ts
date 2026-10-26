import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

/**
 * 在线客服会话（P0-3）：顾客 ↔ 平台/商家的实时 IM 会话。
 * 表已由 p8-p0-privacy-food-safety 迁移建好，环境 synchronize:false，实体只做读写映射。
 */
@Entity()
@Index('idx_campus_chat_conv_channel', ['channelId', 'lastMessageAt'])
@Index('idx_campus_chat_conv_customer', ['channelId', 'customerId'])
export class CampusChatConversation extends VendureEntity {
    [key: string]: any;
    @Column('int') channelId: ID;
    @Column('int') customerId: ID;
    /** 关联订单（可选）：订单详情「联系客服」发起时带上 */
    @Column({ type: 'varchar', nullable: true }) orderCode: string | null;
    /** 会话标题（可选，缺省由订单号/顾客名兜底） */
    @Column({ type: 'varchar', nullable: true }) subject: string | null;
    /** open / closed */
    @Column({ default: 'open' }) status: string;
    /** 最后一条消息摘要（列表页直接展示，避免 N+1 拉消息） */
    @Column({ type: 'varchar', nullable: true }) lastMessage: string | null;
    @Column({ type: 'timestamptz', nullable: true }) lastMessageAt: Date | null;
    /** 最后一条消息的发件方：customer / admin */
    @Column({ type: 'varchar', nullable: true }) lastSenderType: string | null;
    @Column({ type: 'int', default: 0 }) unreadForCustomer: number;
    @Column({ type: 'int', default: 0 }) unreadForAdmin: number;
    @Column({ type: 'timestamptz', nullable: true }) closedAt: Date | null;
    constructor(input?: DeepPartial<CampusChatConversation>) {
        super(input);
    }
}

/** 会话消息：senderType=customer/admin（商家与平台运营共用 admin 侧） */
@Entity()
@Index('idx_campus_chat_msg_conv', ['conversationId', 'id'])
export class CampusChatMessage extends VendureEntity {
    [key: string]: any;
    @Column('int') conversationId: ID;
    @Column() senderType: string;
    /** 发件人（admin 侧为后台用户 id，顾客侧为 customer id） */
    @Column({ type: 'int', nullable: true }) senderId: number | null;
    @Column({ type: 'text', nullable: true }) content: string | null;
    /** 图片 URL 列表（simple-array，逗号分隔） */
    @Column({ type: 'simple-array', nullable: true }) images: string[] | null;
    @Column({ type: 'timestamptz', nullable: true }) readAt: Date | null;
    constructor(input?: DeepPartial<CampusChatMessage>) {
        super(input);
    }
}
