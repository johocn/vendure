import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

/** 客服工单（站内留言，非实时 IM）：顾客提交 → 运营回复 → 关闭。 */
@Entity()
@Index('idx_campus_support_ticket_channel', ['channelId', 'status'])
export class CampusSupportTicket extends VendureEntity {
    [key: string]: any;
    @Column('int') channelId: ID;
    @Column('int') customerId: ID;
    @Column({ type: 'varchar', nullable: true }) orderCode: string | null;
    /** order / delivery / refund / invoice / other */
    @Column() category: string;
    @Column({ type: 'text' }) content: string;
    /** 图片 URL 列表（simple-array，逗号分隔） */
    @Column({ type: 'simple-array', nullable: true }) images: string[] | null;
    /** open / replied / closed */
    @Column({ default: 'open' }) status: string;
    @Column({ type: 'text', nullable: true }) reply: string | null;
    @Column({ type: 'varchar', nullable: true }) repliedBy: string | null;
    @Column({ type: 'timestamptz', nullable: true }) repliedAt: Date | null;
    constructor(input?: DeepPartial<CampusSupportTicket>) {
        super(input);
    }
}

/** 骑手申诉：信用扣分申诉单，后台审核通过后回补信用分。 */
@Entity()
@Index('idx_campus_rider_appeal_channel', ['channelId', 'status'])
export class CampusRiderAppeal extends VendureEntity {
    [key: string]: any;
    @Column('int') channelId: ID;
    @Column('int') riderCustomerId: ID;
    @Column({ type: 'int', nullable: true }) orderId: number | null;
    @Column({ type: 'varchar', nullable: true }) orderCode: string | null;
    @Column({ type: 'text' }) reason: string;
    @Column({ type: 'simple-array', nullable: true }) images: string[] | null;
    /** pending / approved / rejected */
    @Column({ default: 'pending' }) status: string;
    /** 审核通过时回补的信用分（正数） */
    @Column({ type: 'int', default: 0 }) creditDelta: number;
    @Column({ type: 'text', nullable: true }) reviewNote: string | null;
    @Column({ type: 'varchar', nullable: true }) reviewedBy: string | null;
    @Column({ type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
    constructor(input?: DeepPartial<CampusRiderAppeal>) {
        super(input);
    }
}

/** 下单黑名单：user（customerId）/ phone。命中后在支付前置闸门拦截。 */
@Entity()
@Index('idx_campus_blacklist_channel', ['channelId', 'active'])
export class CampusBlacklist extends VendureEntity {
    [key: string]: any;
    @Column('int') channelId: ID;
    /** user / phone */
    @Column() type: string;
    @Column({ type: 'int', nullable: true }) customerId: number | null;
    @Column({ type: 'varchar', nullable: true }) phone: string | null;
    @Column({ type: 'varchar', nullable: true }) reason: string | null;
    @Column({ type: 'varchar', nullable: true }) createdBy: string | null;
    @Column({ default: true }) active: boolean;
    constructor(input?: DeepPartial<CampusBlacklist>) {
        super(input);
    }
}
