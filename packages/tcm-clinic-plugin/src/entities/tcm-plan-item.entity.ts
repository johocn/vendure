import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_plan_item' })
@Index(['planId'])
export class TcmPlanItem extends VendureEntity {
    constructor(input?: DeepPartial<TcmPlanItem>) {
        super(input);
    }
    @Column({ type: 'int' })
    planId: number;
    @Column({ type: 'varchar', length: 255 })
    title: string;
    /** 频次描述，如“每周二/四”“每晚” */
    @Column({ type: 'varchar', length: 128, nullable: true })
    frequency?: string;
    /** 关联商城服务商品（不建外键） */
    @Column({ type: 'int', nullable: true })
    productVariantId?: number;
    /** 患者下单后回填（不建外键） */
    @Column({ type: 'int', nullable: true })
    orderId?: number;
}
