import { Channel, Customer, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

/**
 * 江湖传信者档案：1:1 挂 Customer。
 * 段位/声望/结构性晋升计数/日上限均落在此表；声望变动通过 JianghuRecord 留痕。
 */
@Entity('jianghu_profile')
@Index(['customerId'], { unique: true })
export class JianghuProfile extends VendureEntity {
    // Vendure 实体惯例：索引签名让 TypeORM Repository 的重载正确绑定
    [key: string]: any;

    constructor(input?: DeepPartial<JianghuProfile>) {
        super(input);
    }

    @Column('int')
    customerId: number;

    @Column({ type: 'varchar', default: '江湖新丁' })
    nickname: string;

    /** 江湖声望：只增不减（违规处罚除外） */
    @Column('int', { default: 0 })
    rep: number;

    /** 情报值（方向二） */
    @Column('int', { default: 0 })
    intel: number;

    /** 当前段位编码 L1..L9 */
    @Column({ type: 'varchar', default: 'L1' })
    rankCode: string;

    /** 骑手信用分镜像：<60 冻结江湖任务 */
    @Column('int', { default: 100 })
    credit: number;

    @Column('int', { default: 0 })
    letterDone: number;
    @Column('int', { default: 0 })
    intelDone: number;
    @Column('int', { default: 0 })
    plotDone: number;
    @Column('int', { default: 0 })
    urgentDone: number;
    @Column('int', { default: 0 })
    secretDone: number;

    @Column('int', { default: 0 })
    repToday: number;
    @Column('int', { default: 300 })
    repDailyCap: number;
    /** 日界限 'YYYY-MM-DD'，跨天重置 repToday */
    @Column({ type: 'varchar', nullable: true })
    repDay: string | null;

    @Column('int', { default: 0 })
    streakDays: number;
    @Column({ type: 'varchar', nullable: true })
    lastActiveDay: string | null;

    /** 段位保护期（ISO） */
    @Column({ type: 'varchar', nullable: true })
    protectedUntil: string | null;
    /** 面壁结束时间（ISO）；非空即冻结 */
    @Column({ type: 'varchar', nullable: true })
    frozenUntil: string | null;
    @Column('int', { default: 0 })
    violateCount: number;

    @Column({ type: 'varchar', nullable: true })
    campusCode: string | null;

    @ManyToOne(() => Customer)
    customer?: Customer;

    @ManyToOne(() => Channel)
    channel?: Channel;
}
