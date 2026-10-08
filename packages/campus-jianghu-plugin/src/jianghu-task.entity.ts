import { Channel, Customer, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

/**
 * 江湖任务（三方向共用主表，type 区分 LETTER / INTEL / PLOT）。
 * OPEN → TAKEN → SUBMITTED → VERIFIED / REJECTED，超时回 OPEN 或 EXPIRED。
 */
@Entity('jianghu_task')
@Index(['status'])
@Index(['type'])
export class JianghuTask extends VendureEntity {
    [key: string]: any;

    constructor(input?: DeepPartial<JianghuTask>) {
        super(input);
    }

    @Column({ type: 'varchar' })
    type: 'LETTER' | 'INTEL' | 'PLOT';
    @Column({ type: 'varchar' })
    level: 'NORMAL' | 'URGENT' | 'SECRET';
    @Column({ type: 'varchar' })
    title: string;
    /** 列表态展示的密文/摘要 */
    @Column({ type: 'varchar', nullable: true })
    brief: string | null;
    /** 密语明文：仅 TAKEN 后服务端下发 */
    @Column({ type: 'text', nullable: true })
    plainText: string | null;

    @Column({ type: 'varchar', nullable: true })
    campusCode: string | null;
    @Column({ type: 'varchar', nullable: true })
    buildingCode: string | null;

    /** 收信人 NPC：只存打码代号，不暴露真实身份 */
    @Index()
    @Column('int', { nullable: true })
    targetCustomerId: number | null;
    @Column({ type: 'varchar', nullable: true })
    targetNick: string | null;
    @Column({ type: 'varchar', nullable: true })
    targetBuilding: string | null;

    @Column('int', { default: 10 })
    rewardRep: number;
    @Column('int', { nullable: true })
    rewardIntel: number | null;

    @Column({ type: 'varchar' })
    verifyMode: 'CODE' | 'QR' | 'LBS' | 'ORDER_BIND';

    /** 虚实联动：绑定的真实订单 */
    @Column({ type: 'varchar', nullable: true })
    boundOrderId: string | null;

    @Column({ type: 'varchar', default: 'OPEN' })
    status: 'OPEN' | 'TAKEN' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

    @Column('int', { nullable: true })
    takenByCustomerId: number | null;
    @Column({ type: 'varchar', nullable: true })
    takenAt: string | null;
    @Column({ type: 'varchar', nullable: true })
    expireAt: string | null;

    /** 一次性 6 位暗号（60s 有效） */
    @Column({ type: 'varchar', nullable: true })
    verifyCode: string | null;
    @Column({ type: 'varchar', nullable: true })
    codeExpireAt: string | null;
    /** 试错计数，上限 3 */
    @Column('int', { default: 0 })
    tryCount: number;

    /** LBS 围栏坐标 */
    @Column('float', { nullable: true })
    lat: number | null;
    @Column('float', { nullable: true })
    lng: number | null;

    @Column({ type: 'varchar', nullable: true })
    channelId: string | null;

    @ManyToOne(() => Customer)
    takenBy?: Customer;
    @ManyToOne(() => Customer)
    target?: Customer;
    @ManyToOne(() => Channel)
    channel?: Channel;
}
