import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

import { ItemKind, ItemStatus, LateFeeRule, ScheduleTrigger } from './schedule-config';

/**
 * 期次（调度实例的一期）。状态机：
 * locked → payable（触发满足/事件/手动）→ paid / overdue → forfeited | refunded | waived
 * 违约动作只作用于 overdue 期。
 */
@Entity()
export class OrderScheduleItem extends VendureEntity {
    constructor(input?: DeepPartial<OrderScheduleItem>) {
        super(input);
    }

    @Column({ type: 'int' })
    scheduleId: number;

    @Column({ type: 'int' })
    seq: number;

    @Column('varchar')
    kind: ItemKind;

    /** 应付金额（分，下单时快照） */
    @Column({ type: 'int' })
    amount: number;

    /** COD 仅限尾款/租金/分期期（见 COD_ALLOWED_KINDS） */
    @Column({ type: 'boolean', default: false })
    allowCod: boolean;

    @Column('simple-json')
    trigger: ScheduleTrigger;

    /** 计算后的应付时点（date/interval 在创建或解锁时落值） */
    @Column({ type: 'datetime', nullable: true })
    dueAt: Date | null;

    /** 宽限期（小时）：dueAt + graceHours 之后转 overdue */
    @Column({ type: 'int', default: 0 })
    graceHours: number;

    @Column('simple-json', { nullable: true })
    lateFeeRule: LateFeeRule | null;

    @Column('varchar', { default: 'locked' })
    status: ItemStatus;

    @Column({ type: 'datetime', nullable: true })
    paidAt: Date | null;

    @Column({ type: 'int', nullable: true })
    paymentId: number | null;

    /**
     * trigger.type=group_buy 时的镜像列（便于按活动索引查询，JSON 字段无法跨方言检索）。
     */
    @Column({ type: 'int', nullable: true })
    groupBuyActivityId: number | null;
}
