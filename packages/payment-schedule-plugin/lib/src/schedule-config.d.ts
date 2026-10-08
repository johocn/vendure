/**
 * 统一支付计划：配置结构与纯函数（SSR/调度/单测共用，无 IO）。
 * 金额单位一律「分」，比例一律小数（0.2 = 20%），期次宽限单位小时。
 */
export type ScheduleScenario = 'presale' | 'installment' | 'rental';
export type DeliveryGate = 'all_paid' | 'first_period' | 'deposit_paid';
export type DepositKind = 'legal_deposit' | 'earnest' | 'down_payment' | 'security_deposit';
export type ItemKind = 'deposit' | 'balance' | 'down_payment' | 'installment' | 'rent' | 'buyout';
export type ScheduleStatus = 'pending' | 'in_progress' | 'completed' | 'breached' | 'cancelled';
export type ItemStatus = 'locked' | 'payable' | 'paid' | 'overdue' | 'forfeited' | 'refunded' | 'waived';
export type ScheduleBreachType = 'buyer_timeout' | 'seller_breach' | 'group_buy_failed';
export declare const LEGAL_DEPOSIT_CAP_RATIO = 0.2;
/** COD 仅允许出现在尾款/租金/分期期（设计 §2：仅尾款期/租金期） */
export declare const COD_ALLOWED_KINDS: ReadonlyArray<ItemKind>;
export interface DepositRule {
    kind: DepositKind;
    capRatio?: number;
    earnestRefundPolicy?: {
        onTimeout: 'full' | 'partial';
        partialRate?: number;
    };
}
export interface LateFeeRule {
    /** 每日滞纳金比例（0.001 = 0.1%/天） */
    dailyRate: number;
}
export type ScheduleTrigger = {
    type: 'date';
    at: string;
} | {
    type: 'interval';
    unit: 'day' | 'week' | 'month';
    count: number;
    anchor: 'order_placed' | 'shipped';
} | {
    type: 'group_buy';
    groupBuyActivityId: number;
} | {
    type: 'manual';
};
export declare function parseDepositRule(v: unknown): DepositRule | null;
export declare function parseTrigger(v: unknown): ScheduleTrigger | null;
export declare function addInterval(from: Date, unit: 'day' | 'week' | 'month', count: number): Date;
/** 计算期次应付时点：date→at；interval→anchorTime + count 单位；manual/group_buy→null（由事件/手动开启） */
export declare function computeDueAt(trigger: ScheduleTrigger, anchorTime: Date): Date | null;
/** 触发条件是否已满足（时间型）；manual/group_buy 由事件/管理员开启，不按时间判定 */
export declare function isTriggerSatisfied(trigger: ScheduleTrigger | null, item: {
    dueAt?: Date | null;
} | null, now: Date): boolean;
/** 滞纳金（仅 overdue 且配置 lateFeeRule；按完整天累计，不足 1 天计 0） */
export declare function lateFeeAccrued(item: {
    amount: number;
    status: string;
    dueAt?: Date | string | null;
    graceHours?: number;
    lateFeeRule?: LateFeeRule | null;
}, now: Date): number;
/** 订金退款金额（买家违约/取消时）：full→全额；partial→floor(amount*rate) */
export declare function earnestRefundAmount(item: {
    amount: number;
}, rule: DepositRule): number;
/** 分期金额拆分：首付 = floor(total*ratio%)；余款均分，余数并入末期。返回 [首付, 期1..期n] */
export declare function splitInstallmentAmounts(total: number, downRatioPercent: number, periods: number): number[];
