import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

export type CommunityCommissionStatus = 'pending' | 'paid';

@Entity()
export class CommunityCommissionEntry extends VendureEntity {
    constructor(input?: DeepPartial<CommunityCommissionEntry>) {
        super(input);
    }
    @Index()
    @Column({ type: 'int' })
    leaderId: number;

    @Index({ unique: true })
    @Column()
    orderId: number;

    @Column({ type: 'bigint' }) // 佣金(分)
    amount: number;

    @Column({ default: 'pending' })
    status: CommunityCommissionStatus;
}