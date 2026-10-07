import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

export enum PaymentTimeoutType { REMIND = 'REMIND', CANCEL = 'CANCEL' }
export enum PaymentTimeoutStatus { PENDING = 'PENDING', EXECUTED = 'EXECUTED', CANCELLED = 'CANCELLED', FAILED = 'FAILED' }

/** 待付款定时任务：订单进入 ArrangingPayment 时登记 +10min 提醒 / +15min 取消（时长常量，spec §4.3） */
@Entity()
export class PaymentTimeoutTask extends VendureEntity {
    [key: string]: any;
    @Column('int') orderId: ID;
    @Column('int') channelId: ID;
    @Column({ type: 'varchar' }) type: PaymentTimeoutType;
    @Column({ type: 'timestamptz' }) dueAt: Date;
    @Column({ type: 'varchar', default: PaymentTimeoutStatus.PENDING }) status: PaymentTimeoutStatus;
    @Column({ type: 'varchar' }) expectedState: string; // 登记时订单状态（到点复查）
    @Column({ type: 'int', default: 0 }) retryCount: number;
    @Column({ type: 'varchar', nullable: true }) lastError: string | null;
    constructor(input?: DeepPartial<PaymentTimeoutTask>) { super(input); }
}
