"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const schedule_config_1 = require("./schedule-config");
(0, vitest_1.describe)('parseDepositRule', () => {
    (0, vitest_1.it)('合法 kind 解析通过', () => {
        (0, vitest_1.expect)((0, schedule_config_1.parseDepositRule)({ kind: 'legal_deposit', capRatio: 0.2 })).toEqual({
            kind: 'legal_deposit',
            capRatio: 0.2,
        });
    });
    (0, vitest_1.it)('earnest 带 partial 策略', () => {
        (0, vitest_1.expect)((0, schedule_config_1.parseDepositRule)({ kind: 'earnest', earnestRefundPolicy: { onTimeout: 'partial', partialRate: 0.5 } })).toEqual({
            kind: 'earnest',
            earnestRefundPolicy: { onTimeout: 'partial', partialRate: 0.5 },
        });
    });
    (0, vitest_1.it)('坏 JSON / 非法 kind 返回 null', () => {
        (0, vitest_1.expect)((0, schedule_config_1.parseDepositRule)(null)).toBeNull();
        (0, vitest_1.expect)((0, schedule_config_1.parseDepositRule)('x')).toBeNull();
        (0, vitest_1.expect)((0, schedule_config_1.parseDepositRule)({ kind: 'nope' })).toBeNull();
    });
});
(0, vitest_1.describe)('parseTrigger', () => {
    (0, vitest_1.it)('date 触发器', () => {
        (0, vitest_1.expect)((0, schedule_config_1.parseTrigger)({ type: 'date', at: '2026-01-01T00:00:00.000Z' })).toEqual({
            type: 'date',
            at: '2026-01-01T00:00:00.000Z',
        });
    });
    (0, vitest_1.it)('interval 触发器', () => {
        (0, vitest_1.expect)((0, schedule_config_1.parseTrigger)({ type: 'interval', unit: 'month', count: 2, anchor: 'order_placed' })).toEqual({
            type: 'interval',
            unit: 'month',
            count: 2,
            anchor: 'order_placed',
        });
    });
    (0, vitest_1.it)('group_buy / manual', () => {
        (0, vitest_1.expect)((0, schedule_config_1.parseTrigger)({ type: 'group_buy', groupBuyActivityId: 3 })).toEqual({
            type: 'group_buy',
            groupBuyActivityId: 3,
        });
        (0, vitest_1.expect)((0, schedule_config_1.parseTrigger)({ type: 'manual' })).toEqual({ type: 'manual' });
        (0, vitest_1.expect)((0, schedule_config_1.parseTrigger)({ type: 'wat' })).toBeNull();
    });
});
(0, vitest_1.describe)('addInterval / computeDueAt', () => {
    (0, vitest_1.it)('day/week/month 递增', () => {
        const from = new Date('2026-01-30T00:00:00.000Z');
        (0, vitest_1.expect)((0, schedule_config_1.addInterval)(from, 'day', 1).getUTCDate()).toBe(31);
        (0, vitest_1.expect)((0, schedule_config_1.addInterval)(from, 'week', 1).getUTCDate()).toBe(6);
        // 月末溢出由 Date.setMonth 归约到 3 月 2 日（1月30 + 1月 + 1月 = 3月，非闰年 30+28 天溢出）
        (0, vitest_1.expect)((0, schedule_config_1.addInterval)(from, 'month', 1).getUTCMonth()).toBe(2);
    });
    (0, vitest_1.it)('computeDueAt: date→at; interval→anchor+count; manual/group_buy→null', () => {
        const anchor = new Date('2026-01-01T00:00:00.000Z');
        (0, vitest_1.expect)((0, schedule_config_1.computeDueAt)({ type: 'date', at: '2026-02-01T00:00:00.000Z' }, anchor)).toEqual(new Date('2026-02-01T00:00:00.000Z'));
        (0, vitest_1.expect)((0, schedule_config_1.computeDueAt)({ type: 'interval', unit: 'day', count: 7, anchor: 'order_placed' }, anchor)).toEqual(new Date('2026-01-08T00:00:00.000Z'));
        (0, vitest_1.expect)((0, schedule_config_1.computeDueAt)({ type: 'manual' }, anchor)).toBeNull();
        (0, vitest_1.expect)((0, schedule_config_1.computeDueAt)({ type: 'group_buy', groupBuyActivityId: 1 }, anchor)).toBeNull();
    });
});
(0, vitest_1.describe)('isTriggerSatisfied', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    (0, vitest_1.it)('date 到点满足', () => {
        (0, vitest_1.expect)((0, schedule_config_1.isTriggerSatisfied)({ type: 'date', at: '2026-05-31T00:00:00.000Z' }, null, now)).toBe(true);
        (0, vitest_1.expect)((0, schedule_config_1.isTriggerSatisfied)({ type: 'date', at: '2026-06-02T00:00:00.000Z' }, null, now)).toBe(false);
    });
    (0, vitest_1.it)('interval 按 dueAt 判定', () => {
        (0, vitest_1.expect)((0, schedule_config_1.isTriggerSatisfied)({ type: 'interval', unit: 'day', count: 1, anchor: 'order_placed' }, { dueAt: new Date('2026-05-31T00:00:00.000Z') }, now)).toBe(true);
        (0, vitest_1.expect)((0, schedule_config_1.isTriggerSatisfied)({ type: 'interval', unit: 'day', count: 1, anchor: 'order_placed' }, { dueAt: null }, now)).toBe(false);
    });
    (0, vitest_1.it)('manual / group_buy 永不由时间判定满足', () => {
        (0, vitest_1.expect)((0, schedule_config_1.isTriggerSatisfied)({ type: 'manual' }, null, now)).toBe(false);
        (0, vitest_1.expect)((0, schedule_config_1.isTriggerSatisfied)({ type: 'group_buy', groupBuyActivityId: 1 }, null, now)).toBe(false);
    });
});
(0, vitest_1.describe)('lateFeeAccrued', () => {
    const rule = { dailyRate: 0.001 };
    (0, vitest_1.it)('非 overdue / 无规则 / 宽限期内 → 0', () => {
        const now = new Date('2026-06-01T00:00:00.000Z');
        (0, vitest_1.expect)((0, schedule_config_1.lateFeeAccrued)({ amount: 10000, status: 'payable', dueAt: '2026-05-01T00:00:00.000Z', graceHours: 72, lateFeeRule: rule }, now)).toBe(0);
        (0, vitest_1.expect)((0, schedule_config_1.lateFeeAccrued)({ amount: 10000, status: 'overdue', dueAt: '2026-05-01T00:00:00.000Z', graceHours: 0, lateFeeRule: null }, now)).toBe(0);
        (0, vitest_1.expect)((0, schedule_config_1.lateFeeAccrued)({ amount: 10000, status: 'overdue', dueAt: '2026-05-31T12:00:00.000Z', graceHours: 0, lateFeeRule: rule }, now)).toBe(0);
    });
    (0, vitest_1.it)('按天累计：逾期 3 天 = floor(amount * dailyRate * 3)', () => {
        const now = new Date('2026-06-04T00:00:00.000Z');
        (0, vitest_1.expect)((0, schedule_config_1.lateFeeAccrued)({ amount: 100000, status: 'overdue', dueAt: '2026-06-01T00:00:00.000Z', graceHours: 0, lateFeeRule: rule }, now)).toBe(300);
    });
});
(0, vitest_1.describe)('earnestRefundAmount', () => {
    (0, vitest_1.it)('无策略或 full → 全额', () => {
        (0, vitest_1.expect)((0, schedule_config_1.earnestRefundAmount)({ amount: 30000 }, { kind: 'earnest' })).toBe(30000);
        (0, vitest_1.expect)((0, schedule_config_1.earnestRefundAmount)({ amount: 30000 }, { kind: 'earnest', earnestRefundPolicy: { onTimeout: 'full' } })).toBe(30000);
    });
    (0, vitest_1.it)('partial → floor(amount * rate)，rate 钳制 [0,1]', () => {
        (0, vitest_1.expect)((0, schedule_config_1.earnestRefundAmount)({ amount: 30001 }, { kind: 'earnest', earnestRefundPolicy: { onTimeout: 'partial', partialRate: 0.5 } })).toBe(15000);
        (0, vitest_1.expect)((0, schedule_config_1.earnestRefundAmount)({ amount: 30000 }, { kind: 'earnest', earnestRefundPolicy: { onTimeout: 'partial', partialRate: 5 } })).toBe(30000);
        (0, vitest_1.expect)((0, schedule_config_1.earnestRefundAmount)({ amount: 30000 }, { kind: 'earnest', earnestRefundPolicy: { onTimeout: 'partial', partialRate: -1 } })).toBe(0);
    });
});
(0, vitest_1.describe)('splitInstallmentAmounts', () => {
    (0, vitest_1.it)('首付 + 均分期次，余数并入末期', () => {
        // 1000 分首付 10% → 100；余 900 分 4 期 → 225*4
        (0, vitest_1.expect)((0, schedule_config_1.splitInstallmentAmounts)(1000, 10, 4)).toEqual([100, 225, 225, 225, 225]);
        // 余数：1000 分首付 0% 3 期 → 333/333/334
        (0, vitest_1.expect)((0, schedule_config_1.splitInstallmentAmounts)(1000, 0, 3)).toEqual([0, 333, 333, 334]);
        // 合计守恒
        const parts = (0, schedule_config_1.splitInstallmentAmounts)(9999, 20, 7);
        (0, vitest_1.expect)(parts.reduce((a, b) => a + b, 0)).toBe(9999);
    });
});
(0, vitest_1.describe)('LEGAL_DEPOSIT_CAP_RATIO', () => {
    (0, vitest_1.it)('法定定金上限比例 0.2', () => {
        (0, vitest_1.expect)(schedule_config_1.LEGAL_DEPOSIT_CAP_RATIO).toBe(0.2);
    });
});
