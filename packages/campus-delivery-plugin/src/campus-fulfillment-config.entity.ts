import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class CampusFulfillmentConfig extends VendureEntity {
    [key: string]: any;
    @Column('int', { unique: true }) channelId: ID;
    @Column({ type: 'simple-json', default: '["R1","R3","R4","R5"]' })
    routesEnabled: string[];
    @Column({ type: 'int', default: 100 }) riderCommissionRate: number; // 百分比
    @Column({ type: 'int', default: 10 }) autoAssignMinutes: number;
    @Column({ default: false }) paused: boolean; // 运力暂停开关
    constructor(input?: DeepPartial<CampusFulfillmentConfig>) {
        super(input);
    }
}
