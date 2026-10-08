import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

import { DeliveryGate, DepositRule, ScheduleBreachType, ScheduleScenario, ScheduleStatus } from './schedule-config';

/**
 * 订单级支付计划实例（下单时快照，改配置不影响已生成订单）。
 */
@Entity()
export class OrderPaymentSchedule extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<OrderPaymentSchedule>) {
        super(input);
    }

    @Column({ type: 'int' })
    orderId: number;

    @Column({ type: 'int' })
    channelId: number;

    @Column('varchar')
    scenario: ScheduleScenario;

    /** 发货门控：all_paid（预订：付清才发货）| first_period（分期）| deposit_paid（租赁） */
    @Column('varchar')
    deliveryGate: DeliveryGate;

    /** 款项性质规则（null = 无担保语义，如全款预售） */
    @Column('simple-json', { nullable: true })
    depositRule: DepositRule | null;

    /** 协议版本快照（弹窗勾选留痕依据） */
    @Column('varchar')
    agreementVersion: string;

    @Column('varchar', { default: 'pending' })
    status: ScheduleStatus;

    @Column('varchar', { nullable: true })
    breachType: ScheduleBreachType | null;

    /** 发货承诺（超过未发货 → seller_breach 待确认） */
    @Column({ nullable: true })
    shipDeadline?: Date;

    /** 场景扩展快照（如租赁：{ rental: { buyoutPrice, allowBuyout } }，改配置不影响已生成订单） */
    @Column('simple-json', { nullable: true })
    meta: Record<string, unknown> | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
