import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, ManyToOne } from 'typeorm';

export enum BalanceTransactionType {
    RECHARGE = 'recharge',
    CONSUME = 'consume',
    REFUND = 'refund',
    FREEZE = 'freeze',
    UNFREEZE = 'unfreeze',
    ADJUST = 'adjust',
}

@Entity()
export class BalanceTransaction extends VendureEntity {
    constructor(input?: DeepPartial<BalanceTransaction>) {
        super(input);
    }

    @Column() customerId: number;

    @Column({ type: 'varchar' }) type: BalanceTransactionType;

    @Column({ type: 'int' }) amount: number;

    @Column({ type: 'int' }) balanceBefore: number;

    @Column({ type: 'int' }) balanceAfter: number;

    @Column({ type: 'int', nullable: true }) orderId: number | null;

    @Column({ type: 'int', nullable: true }) paymentId: number | null;

    @Column({ type: 'int', nullable: true }) rechargeCardId: number | null;

    @Column({ type: 'text', nullable: true }) remark: string | null;

    @ManyToOne(() => Channel) channel: Channel;

    @Column() channelId: number;
}
