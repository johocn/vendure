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
    @Column({ type: 'int', default: 30 }) autoRefundMinutes: number; // T4 终态
    @Column({ type: 'int', default: 45 }) inProgressSlaMinutes: number; // T3 SLA 告警
    @Column({ type: 'varchar', nullable: true }) compensationCouponTemplateId: string; // T4 补偿券模板
    @Column({ type: 'int', nullable: true }) deliveryMinutes: number | null; // 配送时长（分钟）
    @Column({ type: 'int', nullable: true }) minOrderAmount: number | null; // 起送价（分）
    @Column({ type: 'int', nullable: true }) deliveryFee: number | null; // 配送费（分，本期仅展示）
    @Column({ type: 'varchar', nullable: true }) storeAddress: string | null; // 自提地址
    @Column({ type: 'varchar', nullable: true }) storePhone: string | null; // 联系电话
    @Column({ type: 'varchar', nullable: true }) storeNotice: string | null; // 店铺公告
    constructor(input?: DeepPartial<CampusFulfillmentConfig>) {
        super(input);
    }
}
