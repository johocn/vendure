import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne } from 'typeorm';

/** 售后自动化任务类型 */
export enum AfterSalesTimeoutType {
    /** Pending 超时提醒商家 */
    PENDING_REMIND = 'pending_remind',
    /** Pending 超时自动同意（0 小时配置 = 不创建） */
    PENDING_AUTO_APPROVE = 'pending_auto_approve',
    /** RefundFailed 自动重试（0 次配置 = 不创建） */
    REFUND_RETRY = 'refund_retry',
}

export enum AfterSalesTimeoutStatus {
    PENDING = 'pending',
    CANCELLED = 'cancelled',
    EXECUTED = 'executed',
    FAILED = 'failed',
}

/**
 * 售后超时自动化任务。
 * delayed job 模式（同 order-timeout-plugin）：SQL JobQueue 忽略 delay 选项，
 * 到期前执行直接跳过，由补偿 ScheduledTask 每 5 分钟扫描 dueAt 过期的 PENDING 任务重新入队；
 * 执行时校验 expectedState 与售后单实际状态一致，否则作废（防止过期动作）。
 */
@Entity()
@Index(['status', 'dueAt'])
export class AfterSalesTimeoutTask extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<AfterSalesTimeoutTask>) {
        super(input);
    }

    @Column({ type: 'varchar' }) type: AfterSalesTimeoutType;
    @Column() requestId: number;
    @Column() channelId: number;
    /** 期望状态（执行时 request.state 不一致即 CANCELLED） */
    @Column({ type: 'varchar' }) expectedState: string;
    @Column() dueAt: Date;
    @Column({ type: 'varchar', default: AfterSalesTimeoutStatus.PENDING }) status: AfterSalesTimeoutStatus;
    /** 业务次数（refund_retry 已执行重试次数） */
    @Column({ type: 'int', default: 0 }) attempt: number;
    /** 业务上限（refund_retry 最大重试次数，0=不限仅用于非重试类型） */
    @Column({ type: 'int', default: 0 }) maxAttempt: number;
    /** 执行失败重试次数（与 order-timeout 同义） */
    @Column({ type: 'int', default: 0 }) retryCount: number;
    @Column({ type: 'text', nullable: true }) lastError: string | null;
    @Column({ nullable: true }) executedAt?: Date;
    @ManyToOne(() => Channel) channel: Channel;
    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
