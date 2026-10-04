import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class RiderEarning extends VendureEntity {
    [key: string]: any;
    @Column() orderId: ID;
    @Column() riderCustomerId: ID;
    @Column({ type: 'int' }) amount: number; // 分成（分）
    @Column({ type: 'int', default: 0 }) tip: number;
    @Column({ default: 'credited' }) status: string;
    @Column() channelId: ID;
    constructor(input?: DeepPartial<RiderEarning>) {
        super(input);
    }
}
