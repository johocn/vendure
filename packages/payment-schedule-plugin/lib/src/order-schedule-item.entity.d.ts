import { DeepPartial, VendureEntity } from '@vendure/core';
import { ItemKind, ItemStatus, LateFeeRule, ScheduleTrigger } from './schedule-config';
/**
 * 期次（调度实例的一期）。状态机：
 * locked → payable（触发满足/事件/手动）→ paid / overdue → forfeited | refunded | waived
 * 违约动作只作用于 overdue 期。
 */
export declare class OrderScheduleItem extends VendureEntity {
    constructor(input?: DeepPartial<OrderScheduleItem>);
    scheduleId: number;
    seq: number;
    kind: ItemKind;
    /** 应付金额（分，下单时快照） */
    amount: number;
    /** COD 仅限尾款/租金/分期期（见 COD_ALLOWED_KINDS） */
    allowCod: boolean;
    trigger: ScheduleTrigger;
    /** 计算后的应付时点（date/interval 在创建或解锁时落值） */
    dueAt: Date | null;
    /** 宽限期（小时）：dueAt + graceHours 之后转 overdue */
    graceHours: number;
    lateFeeRule: LateFeeRule | null;
    status: ItemStatus;
    paidAt: Date | null;
    paymentId: number | null;
    /**
     * trigger.type=group_buy 时的镜像列（便于按活动索引查询，JSON 字段无法跨方言检索）。
     */
    groupBuyActivityId: number | null;
}
