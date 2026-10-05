import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class RiderCreditLog extends VendureEntity {
    [key: string]: any;
    @Column('int') customerId: number;
    @Column({ type: 'int' }) delta: number; // 正=加分 负=扣分
    @Column() reason: string; // reject_assign / timeout_not_picked / complete
    @Column('int', { nullable: true }) orderId: ID;
    @Column('int') channelId: ID;
    constructor(input?: DeepPartial<RiderCreditLog>) {
        super(input);
    }
}
