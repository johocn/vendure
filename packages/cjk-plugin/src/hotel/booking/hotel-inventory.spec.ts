import { describe, expect, it } from 'vitest';

import {
    HOTEL_HOLD_TTL_MINUTES,
    HotelSoldOutError,
    computeRemaining,
    countOccupied,
    enumerateNights,
    findShortNights,
} from './hotel-inventory-logic';

const NOW = new Date('2026-10-10T12:00:00');

describe('enumerateNights', () => {
    it('含 checkIn 不含 checkOut', () => {
        expect(enumerateNights('2026-10-10', '2026-10-13')).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
    });
    it('跨月', () => {
        expect(enumerateNights('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    });
    it('单晚', () => {
        expect(enumerateNights('2026-10-10', '2026-10-11')).toEqual(['2026-10-10']);
    });
    it('非法输入返回空（checkOut ≤ checkIn / 坏日期）', () => {
        expect(enumerateNights('2026-10-10', '2026-10-10')).toEqual([]);
        expect(enumerateNights('2026-10-11', '2026-10-10')).toEqual([]);
        expect(enumerateNights('bad', '2026-10-11')).toEqual([]);
    });
});

describe('computeRemaining（可用性回退链）', () => {
    it('roomDay 行优先于 configTotalRooms', () => {
        expect(computeRemaining({ date: '2026-10-10', totalRooms: 3, closed: false }, 10, 1)).toBe(2);
    });
    it('无 roomDay 行回退 configTotalRooms', () => {
        expect(computeRemaining(null, 5, 2)).toBe(3);
    });
    it('两者都无 → 不限房（null）', () => {
        expect(computeRemaining(null, null, 99)).toBeNull();
    });
    it('closed → 0（关房优先于任何总量）', () => {
        expect(computeRemaining({ date: '2026-10-10', totalRooms: 10, closed: true }, null, 0)).toBe(0);
    });
    it('超订透支截 0', () => {
        expect(computeRemaining({ date: '2026-10-10', totalRooms: 2, closed: false }, null, 5)).toBe(0);
    });
});

describe('countOccupied（占用口径：hold未过期 + booked）', () => {
    const lock = (over: Partial<Parameters<typeof countOccupied>[0][number]> & { orderId?: number }) => ({
        date: '2026-10-10',
        status: 'hold' as const,
        holdExpiresAt: new Date(NOW.getTime() + 60_000),
        ...over,
    });

    it('未过期 hold 与 booked 计入，released 不计入', () => {
        const locks = [lock({}), lock({ status: 'booked' as const, holdExpiresAt: null }), lock({ status: 'released' as const })];
        expect(countOccupied(locks, '2026-10-10', NOW)).toBe(2);
    });
    it('过期 hold 不计入', () => {
        const locks = [lock({ holdExpiresAt: new Date(NOW.getTime() - 1) }), lock({ holdExpiresAt: null })];
        expect(countOccupied(locks, '2026-10-10', NOW)).toBe(0);
    });
    it('按日期过滤 + excludeOrderId 排除本单', () => {
        const locks = [lock({}), lock({ orderId: 7 }), lock({ date: '2026-10-11' })];
        expect(countOccupied(locks, '2026-10-10', NOW)).toBe(2);
        expect(countOccupied(locks, '2026-10-10', NOW, 7)).toBe(1);
    });
});

describe('findShortNights（逐晚校验）', () => {
    const map = (entries: Array<[string, number | null]>) => new Map(entries);
    it('满房与余量不足都拦截', () => {
        const bad = findShortNights(['2026-10-10', '2026-10-11'], map([['2026-10-10', 0], ['2026-10-11', 1]]), 2);
        expect(bad.map(b => b.date)).toEqual(['2026-10-10', '2026-10-11']);
    });
    it('不限房（null）跳过校验', () => {
        expect(findShortNights(['2026-10-10'], map([['2026-10-10', null]]), 99)).toEqual([]);
    });
    it('余量充足通过', () => {
        expect(findShortNights(['2026-10-10', '2026-10-11'], map([['2026-10-10', 3], ['2026-10-11', 2]]), 2)).toEqual([]);
    });
});

describe('HotelSoldOutError', () => {
    it('携带错误码与不可订晚明细', () => {
        const err = new HotelSoldOutError([{ date: '2026-10-10', remaining: 0, reason: 'soldOut' }], 1);
        expect(err.code).toBe('HOTEL_SOLD_OUT');
        expect(err.shortNights[0].date).toBe('2026-10-10');
        expect(err.message).toContain('HOTEL_SOLD_OUT');
    });
    it('TTL 常量 = 15 分钟', () => {
        expect(HOTEL_HOLD_TTL_MINUTES).toBe(15);
    });
});
