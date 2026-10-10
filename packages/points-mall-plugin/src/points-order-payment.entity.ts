import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/** 混合价现金支付单（微信），参照 RechargeOrder 的幂等模式 */
@Entity()
@Index(['orderId'])
export class PointsOrderPayment extends VendureEntity {
    constructor(input?: DeepPartial<PointsOrderPayment>) {
        super(input);
    }

    @Column()
    orderId: number;

    @Column()
    customerId: number;

    @Column({ type: 'int' })
    amount: number; // 分

    @Column({ default: 'pending' })
    status: string; // pending/paid/cancelled

    @Column({ type: 'varchar', nullable: true })
    externalRef: string | null; // outTradeNo

    @Column({ type: 'varchar', nullable: true })
    transactionId: string | null;

    @Column({ type: Date, nullable: true })
    paidAt: Date | null;

    @Column()
    channelId: number;
}
