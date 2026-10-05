import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class DeliverySlot extends VendureEntity {
    [key: string]: any;
    @Column({ type: 'date' }) slotDate: string; // '2026-10-06'
    @Column() startTime: string; // '11:00'
    @Column() endTime: string; // '11:30'
    @Column('int', { nullable: true }) zoneId: ID; // null=全分区通用
    @Column({ type: 'int', default: 20 }) capacity: number;
    @Column({ type: 'int', default: 0 }) lockedCount: number; // 已锁位数量
    @Column({ default: true }) active: boolean;
    @Column('int') channelId: ID;
    constructor(input?: DeepPartial<DeliverySlot>) {
        super(input);
    }
}
