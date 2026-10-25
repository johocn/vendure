import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
@Index('idx_campus_rider_earning_channel_created', ['channelId', 'createdAt'])
@Index('idx_campus_rider_earning_rider_created', ['riderCustomerId', 'createdAt'])
export class RiderEarning extends VendureEntity {
    [key: string]: any;
    @Column('int') orderId: ID;
    @Column('int') riderCustomerId: ID;
    @Column({ type: 'int' }) amount: number; // 分成（分，含小费折算，见 RiderTaskService.calcEarning）
    @Column({ type: 'int', default: 0 }) tip: number; // 其中小费（分，仅展示，不额外叠加）
    @Column({ default: 'credited' }) status: string;
    @Column('int') channelId: ID;
    constructor(input?: DeepPartial<RiderEarning>) {
        super(input);
    }
}
