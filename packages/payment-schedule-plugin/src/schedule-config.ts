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

export const LEGAL_DEPOSIT_CAP_RATIO = 0.2;

/** COD 仅允许出现在尾款/租金/分期期（设计 §2：仅尾款期/租金期） */
export const COD_ALLOWED_KINDS: ReadonlyArray<ItemKind> = ['balance', 'installment', 'rent'];

export interface DepositRule {
    kind: DepositKind;
    capRatio?: number;
    earnestRefundPolicy?: { onTimeout: 'full' | 'partial'; partialRate?: number };
}

export interface LateFeeRule {
    /** 每日滞纳金比例（0.001 = 0.1%/天） */
    dailyRate: number;
}

export type ScheduleTrigger =
    | { type: 'date'; at: string }
    | { type: 'interval'; unit: 'day' | 'week' | 'month'; count: number; anchor: 'order_placed' | 'shipped' }
    | { type: 'group_buy'; groupBuyActivityId: number }
    | { type: 'manual' };

const DEPOSIT_KINDS: ReadonlyArray<DepositKind> = [
    'legal_deposit',
    'earnest',
    'down_payment',
    'security_deposit',
];

const INTERVAL_UNITS = ['day', 'week', 'month'] as const;

export function parseDepositRule(v: unknown): DepositRule | null {
    if (!v || typeof v !== 'object') return null;
    const r = v as Record<string, unknown>;
    if (typeof r.kind !== 'string' || !DEPOSIT_KINDS.includes(r.kind as DepositKind)) return null;
    const rule: DepositRule = { kind: r.kind as DepositKind };
    if (typeof r.capRatio === 'number' && r.capRatio > 0 && r.capRatio < 1) rule.capRatio = r.capRatio;
    if (r.earnestRefundPolicy && typeof r.earnestRefundPolicy === 'object') {
        const p = r.earnestRefundPolicy as Record<string, unknown>;
        if (p.onTimeout === 'full' || p.onTimeout === 'partial') {
            rule.earnestRefundPolicy = { onTimeout: p.onTimeout };
            if (p.onTimeout === 'partial' && typeof p.partialRate === 'number') {
                rule.earnestRefundPolicy.partialRate = Math.min(Math.max(p.partialRate, 0), 1);
            }
        }
    }
    return rule;
}

export function parseTrigger(v: unknown): ScheduleTrigger | null {
    if (!v || typeof v !== 'object') return null;
    const t = v as Record<string, unknown>;
    switch (t.type) {
        case 'date':
            return typeof t.at === 'string' ? { type: 'date', at: t.at } : null;
        case 'interval':
            if (
                (typeof t.unit === 'string' && INTERVAL_UNITS.includes(t.unit as any)) &&
                typeof t.count === 'number' && t.count >= 0 &&
                (t.anchor === 'order_placed' || t.anchor === 'shipped')
            ) {
                return {
                    type: 'interval',
                    unit: t.unit as 'day' | 'week' | 'month',
                    count: t.count,
                    anchor: t.anchor,
                };
            }
            return null;
        case 'group_buy':
            return typeof t.groupBuyActivityId === 'number'
                ? { type: 'group_buy', groupBuyActivityId: t.groupBuyActivityId }
                : null;
        case 'manual':
            return { type: 'manual' };
        default:
            return null;
    }
}

export function addInterval(from: Date, unit: 'day' | 'week' | 'month', count: number): Date {
    const d = new Date(from.getTime());
    switch (unit) {
        case 'day':
            d.setDate(d.getDate() + count);
            break;
        case 'week':
            d.setDate(d.getDate() + count * 7);
            break;
        case 'month':
            d.setMonth(d.getMonth() + count);
            break;
    }
    return d;
}

/** 计算期次应付时点：date→at；interval→anchorTime + count 单位；manual/group_buy→null（由事件/手动开启） */
export function computeDueAt(trigger: ScheduleTrigger, anchorTime: Date): Date | null {
    switch (trigger.type) {
        case 'date':
            return trigger.at ? new Date(trigger.at) : null;
        case 'interval':
            return addInterval(anchorTime, trigger.unit, trigger.count);
        default:
            return null;
    }
}

/** 触发条件是否已满足（时间型）；manual/group_buy 由事件/管理员开启，不按时间判定 */
export function isTriggerSatisfied(
    trigger: ScheduleTrigger | null,
    item: { dueAt?: Date | null } | null,
    now: Date,
): boolean {
    if (!trigger) return false;
    switch (trigger.type) {
        case 'date':
            return !!trigger.at && now >= new Date(trigger.at);
        case 'interval':
            return !!item?.dueAt && now >= item.dueAt;
        default:
            return false;
    }
}

/** 滞纳金（仅 overdue 且配置 lateFeeRule；按完整天累计，不足 1 天计 0） */
export function lateFeeAccrued(
    item: {
        amount: number;
        status: string;
        dueAt?: Date | string | null;
        graceHours?: number;
        lateFeeRule?: LateFeeRule | null;
    },
    now: Date,
): number {
    if (item.status !== 'overdue' || !item.lateFeeRule || !item.dueAt) return 0;
    const graceEnd = new Date(new Date(item.dueAt).getTime() + (item.graceHours ?? 0) * 3600 * 1000);
    const days = Math.floor((now.getTime() - graceEnd.getTime()) / 86400000);
    if (days < 1) return 0;
    return Math.floor(item.amount * item.lateFeeRule.dailyRate * days);
}

/** 订金退款金额（买家违约/取消时）：full→全额；partial→floor(amount*rate) */
export function earnestRefundAmount(item: { amount: number }, rule: DepositRule): number {
    const policy = rule.earnestRefundPolicy;
    if (!policy || policy.onTimeout !== 'partial') return item.amount;
    const rate = Math.min(Math.max(policy.partialRate ?? 0, 0), 1);
    return Math.floor(item.amount * rate);
}

/** 分期金额拆分：首付 = floor(total*ratio%)；余款均分，余数并入末期。返回 [首付, 期1..期n] */
export function splitInstallmentAmounts(total: number, downRatioPercent: number, periods: number): number[] {
    const down = Math.floor((total * downRatioPercent) / 100);
    const rest = total - down;
    const base = Math.floor(rest / periods);
    const amounts = Array.from({ length: periods }, () => base);
    amounts[amounts.length - 1] += rest - base * periods;
    return [down, ...amounts];
}
