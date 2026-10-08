"use strict";
/**
 * 统一支付计划：配置结构与纯函数（SSR/调度/单测共用，无 IO）。
 * 金额单位一律「分」，比例一律小数（0.2 = 20%），期次宽限单位小时。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COD_ALLOWED_KINDS = exports.LEGAL_DEPOSIT_CAP_RATIO = void 0;
exports.parseDepositRule = parseDepositRule;
exports.parseTrigger = parseTrigger;
exports.addInterval = addInterval;
exports.computeDueAt = computeDueAt;
exports.isTriggerSatisfied = isTriggerSatisfied;
exports.lateFeeAccrued = lateFeeAccrued;
exports.earnestRefundAmount = earnestRefundAmount;
exports.splitInstallmentAmounts = splitInstallmentAmounts;
exports.LEGAL_DEPOSIT_CAP_RATIO = 0.2;
/** COD 仅允许出现在尾款/租金/分期期（设计 §2：仅尾款期/租金期） */
exports.COD_ALLOWED_KINDS = ['balance', 'installment', 'rent'];
const DEPOSIT_KINDS = [
    'legal_deposit',
    'earnest',
    'down_payment',
    'security_deposit',
];
const INTERVAL_UNITS = ['day', 'week', 'month'];
function parseDepositRule(v) {
    if (!v || typeof v !== 'object')
        return null;
    const r = v;
    if (typeof r.kind !== 'string' || !DEPOSIT_KINDS.includes(r.kind))
        return null;
    const rule = { kind: r.kind };
    if (typeof r.capRatio === 'number' && r.capRatio > 0 && r.capRatio < 1)
        rule.capRatio = r.capRatio;
    if (r.earnestRefundPolicy && typeof r.earnestRefundPolicy === 'object') {
        const p = r.earnestRefundPolicy;
        if (p.onTimeout === 'full' || p.onTimeout === 'partial') {
            rule.earnestRefundPolicy = { onTimeout: p.onTimeout };
            if (p.onTimeout === 'partial' && typeof p.partialRate === 'number') {
                rule.earnestRefundPolicy.partialRate = Math.min(Math.max(p.partialRate, 0), 1);
            }
        }
    }
    return rule;
}
function parseTrigger(v) {
    if (!v || typeof v !== 'object')
        return null;
    const t = v;
    switch (t.type) {
        case 'date':
            return typeof t.at === 'string' ? { type: 'date', at: t.at } : null;
        case 'interval':
            if ((typeof t.unit === 'string' && INTERVAL_UNITS.includes(t.unit)) &&
                typeof t.count === 'number' && t.count >= 0 &&
                (t.anchor === 'order_placed' || t.anchor === 'shipped')) {
                return {
                    type: 'interval',
                    unit: t.unit,
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
function addInterval(from, unit, count) {
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
function computeDueAt(trigger, anchorTime) {
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
function isTriggerSatisfied(trigger, item, now) {
    if (!trigger)
        return false;
    switch (trigger.type) {
        case 'date':
            return !!trigger.at && now >= new Date(trigger.at);
        case 'interval':
            return !!(item === null || item === void 0 ? void 0 : item.dueAt) && now >= item.dueAt;
        default:
            return false;
    }
}
/** 滞纳金（仅 overdue 且配置 lateFeeRule；按完整天累计，不足 1 天计 0） */
function lateFeeAccrued(item, now) {
    var _a;
    if (item.status !== 'overdue' || !item.lateFeeRule || !item.dueAt)
        return 0;
    const graceEnd = new Date(new Date(item.dueAt).getTime() + ((_a = item.graceHours) !== null && _a !== void 0 ? _a : 0) * 3600 * 1000);
    const days = Math.floor((now.getTime() - graceEnd.getTime()) / 86400000);
    if (days < 1)
        return 0;
    return Math.floor(item.amount * item.lateFeeRule.dailyRate * days);
}
/** 订金退款金额（买家违约/取消时）：full→全额；partial→floor(amount*rate) */
function earnestRefundAmount(item, rule) {
    var _a;
    const policy = rule.earnestRefundPolicy;
    if (!policy || policy.onTimeout !== 'partial')
        return item.amount;
    const rate = Math.min(Math.max((_a = policy.partialRate) !== null && _a !== void 0 ? _a : 0, 0), 1);
    return Math.floor(item.amount * rate);
}
/** 分期金额拆分：首付 = floor(total*ratio%)；余款均分，余数并入末期。返回 [首付, 期1..期n] */
function splitInstallmentAmounts(total, downRatioPercent, periods) {
    const down = Math.floor((total * downRatioPercent) / 100);
    const rest = total - down;
    const base = Math.floor(rest / periods);
    const amounts = Array.from({ length: periods }, () => base);
    amounts[amounts.length - 1] += rest - base * periods;
    return [down, ...amounts];
}
