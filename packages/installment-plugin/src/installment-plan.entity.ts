import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

export type IntervalUnit = 'day' | 'week' | 'month';

/**
 * 分期计划（variant 级配置）。
 * - downPaymentRatio：首付比例（整数百分比 0-90；0 = 无首付）
 * - periods：分期期数（1-36）
 * - intervalCount：间隔数（0 = 立即应付，>0 = 每隔 N 个 unit 一期）
 * - feeRule：手续费规则（仅登记，本次不计费——设计 §11 边界）
 */
@Entity()
export class InstallmentPlan extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<InstallmentPlan>) {
        super(input);
    }

    @Column('varchar')
    name: string;

    @Column({ type: 'int' })
    variantId: number;

    /** 首付比例（0-90，整数百分比） */
    @Column({ type: 'int', default: 0 })
    downPaymentRatio: number;

    /** 分期期数（1-36） */
    @Column({ type: 'int', default: 3 })
    periods: number;

    @Column('varchar', { default: 'month' })
    intervalUnit: IntervalUnit;

    /** 期次间隔（0 = 立即应付；e2e/特殊场景用） */
    @Column({ type: 'int', default: 1 })
    intervalCount: number;

    /** 手续费规则（仅登记） */
    @Column('simple-json', { nullable: true })
    feeRule?: { rate?: number; fixed?: number } | null;

    @Column({ type: 'boolean', default: false })
    allowCod: boolean;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
