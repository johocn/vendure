import { describe, expect, it } from 'vitest';
import {
    checkDailyLimit,
    localDayRange,
    normalizeLimit,
    remainingOf,
} from './daily-limit';

describe('normalizeLimit', () => {
    it('空值 / 0 / 负数 / 非法 → 不限', () => {
        for (const v of [null, undefined, '', 0, '0', -3, 'abc']) {
            expect(normalizeLimit(v)).toBeNull();
        }
    });
    it('正数取整并封顶', () => {
        expect(normalizeLimit(12)).toBe(12);
        expect(normalizeLimit('8.9')).toBe(8);
        expect(normalizeLimit(99999)).toBe(9999);
    });
});

describe('remainingOf', () => {
    it('不限返回 null，售完不为负', () => {
        expect(remainingOf(null, 10)).toBeNull();
        expect(remainingOf(10, 3)).toBe(7);
        expect(remainingOf(10, 10)).toBe(0);
        expect(remainingOf(10, 12)).toBe(0);
    });
});

describe('checkDailyLimit', () => {
    const base = {
        name: '宫保鸡丁',
        quantity: 1,
        dailyLimit: 20,
        perUserLimit: null,
        soldToday: 19,
        mineToday: 0,
    };
    it('未超限放行', () => {
        expect(checkDailyLimit(base)).toBeNull();
    });
    it('每日限量售完拦截（含剩余份数文案）', () => {
        const msg = checkDailyLimit({ ...base, soldToday: 20 });
        expect(msg).toContain('今日限量 20 份');
        expect(msg).toContain('还剩 0 份');
    });
    it('剩余不足本次数量时拦截', () => {
        const msg = checkDailyLimit({ ...base, quantity: 2, soldToday: 19 });
        expect(msg).toContain('还剩 1 份');
    });
    it('每人限购按本人当日已购拦截', () => {
        const msg = checkDailyLimit({
            ...base, dailyLimit: null, perUserLimit: 2, soldToday: 50, mineToday: 2,
        });
        expect(msg).toContain('每人限购 2 份');
        expect(msg).toContain('已购买 2 份');
    });
    it('本人新增数量跨过限购也拦截', () => {
        const msg = checkDailyLimit({
            ...base, dailyLimit: null, perUserLimit: 2, mineToday: 1, quantity: 2,
        });
        expect(msg).toContain('每人限购 2 份');
    });
});

describe('localDayRange', () => {
    it('UTC+8 的当天 00:00 起算，跨度 24h', () => {
        // 2026-10-29T02:30:00Z = 10:30（UTC+8）
        const now = Date.parse('2026-10-29T02:30:00Z');
        const { start, end } = localDayRange(now);
        expect(start.toISOString()).toBe('2026-10-28T16:00:00.000Z');
        expect(end.getTime() - start.getTime()).toBe(86_400_000);
    });
});
