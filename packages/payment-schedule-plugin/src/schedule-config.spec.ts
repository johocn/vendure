import { describe, expect, it } from 'vitest';

import {
    addInterval,
    computeDueAt,
    earnestRefundAmount,
    isTriggerSatisfied,
    lateFeeAccrued,
    LEGAL_DEPOSIT_CAP_RATIO,
    parseDepositRule,
    parseTrigger,
    splitInstallmentAmounts,
} from './schedule-config';

describe('parseDepositRule', () => {
    it('合法 kind 解析通过', () => {
        expect(parseDepositRule({ kind: 'legal_deposit', capRatio: 0.2 })).toEqual({
            kind: 'legal_deposit',
            capRatio: 0.2,
        });
    });
    it('earnest 带 partial 策略', () => {
        expect(
            parseDepositRule({ kind: 'earnest', earnestRefundPolicy: { onTimeout: 'partial', partialRate: 0.5 } }),
        ).toEqual({
            kind: 'earnest',
            earnestRefundPolicy: { onTimeout: 'partial', partialRate: 0.5 },
        });
    });
    it('坏 JSON / 非法 kind 返回 null', () => {
        expect(parseDepositRule(null)).toBeNull();
        expect(parseDepositRule('x')).toBeNull();
        expect(parseDepositRule({ kind: 'nope' })).toBeNull();
    });
});

describe('parseTrigger', () => {
    it('date 触发器', () => {
        expect(parseTrigger({ type: 'date', at: '2026-01-01T00:00:00.000Z' })).toEqual({
            type: 'date',
            at: '2026-01-01T00:00:00.000Z',
        });
    });
    it('interval 触发器', () => {
        expect(parseTrigger({ type: 'interval', unit: 'month', count: 2, anchor: 'order_placed' })).toEqual({
            type: 'interval',
            unit: 'month',
            count: 2,
            anchor: 'order_placed',
        });
    });
    it('group_buy / manual', () => {
        expect(parseTrigger({ type: 'group_buy', groupBuyActivityId: 3 })).toEqual({
            type: 'group_buy',
            groupBuyActivityId: 3,
        });
        expect(parseTrigger({ type: 'manual' })).toEqual({ type: 'manual' });
        expect(parseTrigger({ type: 'wat' })).toBeNull();
    });
});

describe('addInterval / computeDueAt', () => {
    it('day/week/month 递增', () => {
        const from = new Date('2026-01-30T00:00:00.000Z');
        expect(addInterval(from, 'day', 1).getUTCDate()).toBe(31);
        expect(addInterval(from, 'week', 1).getUTCDate()).toBe(6);
        // 月末溢出由 Date.setMonth 归约到 3 月 2 日（1月30 + 1月 + 1月 = 3月，非闰年 30+28 天溢出）
        expect(addInterval(from, 'month', 1).getUTCMonth()).toBe(2);
    });
    it('computeDueAt: date→at; interval→anchor+count; manual/group_buy→null', () => {
        const anchor = new Date('2026-01-01T00:00:00.000Z');
        expect(computeDueAt({ type: 'date', at: '2026-02-01T00:00:00.000Z' }, anchor)).toEqual(
            new Date('2026-02-01T00:00:00.000Z'),
        );
        expect(computeDueAt({ type: 'interval', unit: 'day', count: 7, anchor: 'order_placed' }, anchor)).toEqual(
            new Date('2026-01-08T00:00:00.000Z'),
        );
        expect(computeDueAt({ type: 'manual' }, anchor)).toBeNull();
        expect(computeDueAt({ type: 'group_buy', groupBuyActivityId: 1 }, anchor)).toBeNull();
    });
});

describe('isTriggerSatisfied', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    it('date 到点满足', () => {
        expect(isTriggerSatisfied({ type: 'date', at: '2026-05-31T00:00:00.000Z' }, null, now)).toBe(true);
        expect(isTriggerSatisfied({ type: 'date', at: '2026-06-02T00:00:00.000Z' }, null, now)).toBe(false);
    });
    it('interval 按 dueAt 判定', () => {
        expect(isTriggerSatisfied({ type: 'interval', unit: 'day', count: 1, anchor: 'order_placed' }, { dueAt: new Date('2026-05-31T00:00:00.000Z') }, now)).toBe(true);
        expect(isTriggerSatisfied({ type: 'interval', unit: 'day', count: 1, anchor: 'order_placed' }, { dueAt: null }, now)).toBe(false);
    });
    it('manual / group_buy 永不由时间判定满足', () => {
        expect(isTriggerSatisfied({ type: 'manual' }, null, now)).toBe(false);
        expect(isTriggerSatisfied({ type: 'group_buy', groupBuyActivityId: 1 }, null, now)).toBe(false);
    });
});

describe('lateFeeAccrued', () => {
    const rule = { dailyRate: 0.001 };
    it('非 overdue / 无规则 / 宽限期内 → 0', () => {
        const now = new Date('2026-06-01T00:00:00.000Z');
        expect(lateFeeAccrued({ amount: 10000, status: 'payable', dueAt: '2026-05-01T00:00:00.000Z', graceHours: 72, lateFeeRule: rule }, now)).toBe(0);
        expect(lateFeeAccrued({ amount: 10000, status: 'overdue', dueAt: '2026-05-01T00:00:00.000Z', graceHours: 0, lateFeeRule: null }, now)).toBe(0);
        expect(lateFeeAccrued({ amount: 10000, status: 'overdue', dueAt: '2026-05-31T12:00:00.000Z', graceHours: 0, lateFeeRule: rule }, now)).toBe(0);
    });
    it('按天累计：逾期 3 天 = floor(amount * dailyRate * 3)', () => {
        const now = new Date('2026-06-04T00:00:00.000Z');
        expect(lateFeeAccrued({ amount: 100000, status: 'overdue', dueAt: '2026-06-01T00:00:00.000Z', graceHours: 0, lateFeeRule: rule }, now)).toBe(300);
    });
});

describe('earnestRefundAmount', () => {
    it('无策略或 full → 全额', () => {
        expect(earnestRefundAmount({ amount: 30000 }, { kind: 'earnest' })).toBe(30000);
        expect(earnestRefundAmount({ amount: 30000 }, { kind: 'earnest', earnestRefundPolicy: { onTimeout: 'full' } })).toBe(30000);
    });
    it('partial → floor(amount * rate)，rate 钳制 [0,1]', () => {
        expect(
            earnestRefundAmount({ amount: 30001 }, { kind: 'earnest', earnestRefundPolicy: { onTimeout: 'partial', partialRate: 0.5 } }),
        ).toBe(15000);
        expect(
            earnestRefundAmount({ amount: 30000 }, { kind: 'earnest', earnestRefundPolicy: { onTimeout: 'partial', partialRate: 5 } }),
        ).toBe(30000);
        expect(
            earnestRefundAmount({ amount: 30000 }, { kind: 'earnest', earnestRefundPolicy: { onTimeout: 'partial', partialRate: -1 } }),
        ).toBe(0);
    });
});

describe('splitInstallmentAmounts', () => {
    it('首付 + 均分期次，余数并入末期', () => {
        // 1000 分首付 10% → 100；余 900 分 4 期 → 225*4
        expect(splitInstallmentAmounts(1000, 10, 4)).toEqual([100, 225, 225, 225, 225]);
        // 余数：1000 分首付 0% 3 期 → 333/333/334
        expect(splitInstallmentAmounts(1000, 0, 3)).toEqual([0, 333, 333, 334]);
        // 合计守恒
        const parts = splitInstallmentAmounts(9999, 20, 7);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(9999);
    });
});

describe('LEGAL_DEPOSIT_CAP_RATIO', () => {
    it('法定定金上限比例 0.2', () => {
        expect(LEGAL_DEPOSIT_CAP_RATIO).toBe(0.2);
    });
});
