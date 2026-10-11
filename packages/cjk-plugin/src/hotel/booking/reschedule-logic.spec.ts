import { describe, expect, it } from 'vitest';

import {
    HOTEL_MAX_RESCHEDULES_V1,
    addDaysDateOnly,
    evaluateRescheduleRules,
    isValidDateOnly,
} from './booking-logic';

const NOW = new Date('2026-10-11T08:00:00');

const base = {
    status: 'confirmed' as const,
    rescheduleCount: 0,
    oldCheckIn: '2026-10-13',
    oldCheckOut: '2026-10-15',
    newCheckIn: '2026-10-20',
    newCheckOut: '2026-10-22',
    now: NOW,
};

describe('isValidDateOnly', () => {
    it('接受合法日期，拒绝非法/不存在的日历日', () => {
        expect(isValidDateOnly('2026-10-11')).toBe(true);
        expect(isValidDateOnly('2026-02-29')).toBe(false); // 2026 平年
        expect(isValidDateOnly('2026-13-01')).toBe(false);
        expect(isValidDateOnly('2026-1-1')).toBe(false);
        expect(isValidDateOnly('xxxx-xx-xx')).toBe(false);
        expect(isValidDateOnly(123)).toBe(false);
        expect(isValidDateOnly(null)).toBe(false);
    });
});

describe('addDaysDateOnly', () => {
    it('跨月加减', () => {
        expect(addDaysDateOnly('2026-10-31', 1)).toBe('2026-11-01');
        expect(addDaysDateOnly('2026-03-01', -1)).toBe('2026-02-28');
        expect(addDaysDateOnly('bad', 1)).toBeNull();
    });
});

describe('evaluateRescheduleRules', () => {
    it('合法改期：返回晚数', () => {
        const r = evaluateRescheduleRules({ ...base });
        expect(r).toEqual({ ok: true, nights: 2 });
    });

    it('非 confirmed 一律拒绝', () => {
        for (const status of ['pendingDeposit', 'checkedIn', 'completed', 'cancelled', 'noShow'] as const) {
            const r = evaluateRescheduleRules({ ...base, status });
            expect(r.ok).toBe(false);
            expect((r as any).reason).toBe('notConfirmed');
        }
    });

    it(`已改 ${HOTEL_MAX_RESCHEDULES_V1} 次拒绝（每单限改 1 次）`, () => {
        const r = evaluateRescheduleRules({ ...base, rescheduleCount: 1 });
        expect(r).toMatchObject({ ok: false, reason: 'limitReached' });
    });

    it('日期格式/日历非法、离店不晚于入住 → invalidDates', () => {
        expect(evaluateRescheduleRules({ ...base, newCheckIn: '2026-13-40' })).toMatchObject({
            ok: false,
            reason: 'invalidDates',
        });
        expect(evaluateRescheduleRules({ ...base, newCheckOut: '2026-10-20' })).toMatchObject({
            ok: false,
            reason: 'invalidDates',
        });
        expect(evaluateRescheduleRules({ ...base, newCheckOut: '2026-10-19' })).toMatchObject({
            ok: false,
            reason: 'invalidDates',
        });
    });

    it('新旧日期完全一致 → sameDates', () => {
        const r = evaluateRescheduleRules({
            ...base,
            newCheckIn: '2026-10-13',
            newCheckOut: '2026-10-15',
        });
        expect(r).toMatchObject({ ok: false, reason: 'sameDates' });
    });

    it('入住日早于今天（无 advanceDays）→ advanceDays', () => {
        const r = evaluateRescheduleRules({ ...base, newCheckIn: '2026-10-10', newCheckOut: '2026-10-12' });
        expect(r).toMatchObject({ ok: false, reason: 'advanceDays' });
    });

    it('advanceDays=2：今天 10-11 最早可改至 10-13；10-12 被拒', () => {
        const tooEarly = evaluateRescheduleRules({
            ...base,
            advanceDays: 2,
            newCheckIn: '2026-10-12',
            newCheckOut: '2026-10-14',
        });
        expect(tooEarly).toMatchObject({ ok: false, reason: 'advanceDays' });
        const ok = evaluateRescheduleRules({
            ...base,
            advanceDays: 2,
            newCheckIn: '2026-10-13',
            newCheckOut: '2026-10-14',
        });
        expect(ok).toEqual({ ok: true, nights: 1 });
    });

    it('minNights/maxNights 边界', () => {
        expect(
            evaluateRescheduleRules({ ...base, minNights: 3, newCheckIn: '2026-10-20', newCheckOut: '2026-10-22' }),
        ).toMatchObject({ ok: false, reason: 'tooShort' });
        expect(
            evaluateRescheduleRules({ ...base, maxNights: 1, newCheckIn: '2026-10-20', newCheckOut: '2026-10-22' }),
        ).toMatchObject({ ok: false, reason: 'tooLong' });
        // 边界含端点
        expect(
            evaluateRescheduleRules({ ...base, minNights: 2, maxNights: 2 }),
        ).toEqual({ ok: true, nights: 2 });
    });

    it('延长晚数也可改（nights=4）', () => {
        const r = evaluateRescheduleRules({ ...base, newCheckOut: '2026-10-24' });
        expect(r).toEqual({ ok: true, nights: 4 });
    });
});
