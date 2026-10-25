import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

/** 骑手排班：按日期 + 时段登记，后台视图展示「排班 vs 实际在线」。 */
@Entity()
@Index('idx_campus_rider_shift_day', ['channelId', 'shiftDate'])
export class CampusRiderShift extends VendureEntity {
    [key: string]: any;
    @Column('int') channelId: ID;
    @Column('int') riderCustomerId: ID;
    /** YYYY-MM-DD（校园时区） */
    @Column({ type: 'varchar' }) shiftDate: string;
    /** HH:mm */
    @Column({ type: 'varchar' }) startTime: string;
    @Column({ type: 'varchar' }) endTime: string;
    @Column({ type: 'varchar', nullable: true }) note: string | null;
    constructor(input?: DeepPartial<CampusRiderShift>) {
        super(input);
    }
}

/** 骑手在线会话：上线开、下线/心跳超时关，用于统计实际在线时长。 */
@Entity()
@Index('idx_campus_rider_session_rider', ['channelId', 'riderCustomerId'])
export class CampusRiderSession extends VendureEntity {
    [key: string]: any;
    @Column('int') channelId: ID;
    @Column('int') riderCustomerId: ID;
    @Column({ type: 'timestamptz' }) startedAt: Date;
    @Column({ type: 'timestamptz', nullable: true }) endedAt: Date | null;
    /** 最近心跳：超时（5min）由运力预警 job 关会话 */
    @Column({ type: 'timestamptz', nullable: true }) lastHeartbeatAt: Date | null;
    /** 分钟数（关会话时落库，便于按日聚合；null=进行中） */
    @Column({ type: 'int', nullable: true }) minutes: number | null;
    constructor(input?: DeepPartial<CampusRiderSession>) {
        super(input);
    }
}

/** 用户给骑手评分（1-5 + 标签，一单一条幂等）。 */
@Entity()
export class CampusRiderReview extends VendureEntity {
    [key: string]: any;
    @Column('int') channelId: ID;
    @Column('int') riderCustomerId: ID;
    @Column('int') orderId: number;
    @Column({ type: 'int' }) rating: number;
    @Column({ type: 'simple-array', nullable: true }) tags: string[] | null;
    @Column({ type: 'varchar', nullable: true }) comment: string | null;
    constructor(input?: DeepPartial<CampusRiderReview>) {
        super(input);
    }
}
