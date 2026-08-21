import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity()
export class CommunityParticipation extends VendureEntity {
    constructor(input?: DeepPartial<CommunityParticipation>) {
        super(input);
    }
    @Index()
    @Column()
    activityId: number;

    @Index({ unique: true })
    @Column()
    orderId: number; // 正式订单

    @Column({ type: 'int' })
    leaderId: number;

    @Column({ type: 'bigint' }) // 参与成交额(分)
    subtotal: number;
}