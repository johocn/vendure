import { describe, expect, it } from 'vitest';

import {
    HOTEL_ORDER_PENDING_STATES,
    canCheckIn,
    dailyTransition,
    deriveCancelDeadline,
    generateBookingCode,
    hotelDatesOfLine,
    bookingTotalCent,
    toDateOnly,
    todayStr,
} from './booking-logic';

describe('toDateOnly', () => {
    it('纯日期与带时间后缀均提取 YYYY-MM-DD 前缀', () => {
        expect(toDateOnly('2026-10-10')).toBe('2026-10-10');
        expect(toDateOnly('2026-10-10T14:00:00')).toBe('2026-10-10');
        expect(toDateOnly(' 2026-01-02 ')).toBe('2026-01-02');
    });
    it('非法输入返回 null', () => {
        expect(toDateOnly('bad')).toBeNull();
        expect(toDateOnly('2026-1-2')).toBeNull();
        expect(toDateOnly(123)).toBeNull();
        expect(toDateOnly(null)).toBeNull();
        expect(toDateOnly(undefined)).toBeNull();
    });
});

describe('todayStr', () => {
    it('按服务器本地日期格式化（用固定 Date 验证不依赖真实时钟）', () => {
        expect(todayStr(new Date(2026, 9, 10, 23, 59))).toBe('2026-10-10');
        expect(todayStr(new Date(2026, 0, 3, 0, 0))).toBe('2026-01-03');
    });
});

describe('generateBookingCode', () => {
    it('8 位纯数字', () => {
        for (let i = 0; i < 50; i++) {
            const code = generateBookingCode();
            expect(code).toHaveLength(8);
            expect(code).toMatch(/^\d{8}$/);
        }
    });
});

describe('deriveCancelDeadline（免费取消截止点固化）', () => {
    it('freeUntil 24h + checkInTime 14:00 → 前一天 14:00', () => {
        const d = deriveCancelDeadline({ type: 'freeUntil', freeUntilHours: 24 }, '2026-10-15', '14:00');
        expect(d!.getFullYear()).toBe(2026);
        expect(d!.getMonth()).toBe(9); // 10 月
        expect(d!.getDate()).toBe(14);
        expect(d!.getHours()).toBe(14);
    });
    it('checkInTime 缺省按 00:00 往前推', () => {
        const d = deriveCancelDeadline({ type: 'freeUntil', freeUntilHours: 48 }, '2026-10-15');
        expect(d!.getDate()).toBe(13);
        expect(d!.getHours()).toBe(0);
    });
    it('带秒/时分的 checkInTime 取 HH:mm 前缀', () => {
        const d = deriveCancelDeadline({ type: 'freeUntil', freeUntilHours: 6 }, '2026-10-15', '15:30:00');
        expect(d!.getHours()).toBe(9);
        expect(d!.getMinutes()).toBe(30);
    });
    it('nonRefundable → null（语义为无免费取消窗口）', () => {
        expect(deriveCancelDeadline({ type: 'nonRefundable' }, '2026-10-15', '14:00')).toBeNull();
    });
    it('无政策 / freeUntilHours 非法 → null', () => {
        expect(deriveCancelDeadline(null, '2026-10-15')).toBeNull();
        expect(deriveCancelDeadline(undefined, '2026-10-15')).toBeNull();
        expect(deriveCancelDeadline({ type: 'freeUntil' }, '2026-10-15')).toBeNull();
        expect(deriveCancelDeadline({ type: 'freeUntil', freeUntilHours: 0 }, '2026-10-15')).toBeNull();
        expect(deriveCancelDeadline({ type: 'freeUntil', freeUntilHours: -5 }, '2026-10-15')).toBeNull();
        expect(deriveCancelDeadline({ type: 'freeUntil', freeUntilHours: NaN }, '2026-10-15')).toBeNull();
    });
    it('坏入住日期 → null', () => {
        expect(deriveCancelDeadline({ type: 'freeUntil', freeUntilHours: 24 }, 'bad')).toBeNull();
    });
    it('未知政策类型 → null', () => {
        expect(deriveCancelDeadline({ type: 'weird' } as any, '2026-10-15')).toBeNull();
    });
});

describe('canCheckIn（到店核销前置）', () => {
    const ci = '2026-10-10';
    const co = '2026-10-13';
    it('confirmed 且当日 ∈ [checkIn, checkOut) → true', () => {
        expect(canCheckIn('confirmed', ci, co, '2026-10-10')).toBe(true);
        expect(canCheckIn('confirmed', ci, co, '2026-10-12')).toBe(true);
    });
    it('边界：入住日之前不可、离店日当天不可', () => {
        expect(canCheckIn('confirmed', ci, co, '2026-10-09')).toBe(false);
        expect(canCheckIn('confirmed', ci, co, '2026-10-13')).toBe(false);
    });
    it('非 confirmed 一律不可', () => {
        expect(canCheckIn('pendingDeposit', ci, co, '2026-10-10')).toBe(false);
        expect(canCheckIn('checkedIn', ci, co, '2026-10-10')).toBe(false);
        expect(canCheckIn('completed', ci, co, '2026-10-10')).toBe(false);
        expect(canCheckIn('cancelled', ci, co, '2026-10-10')).toBe(false);
    });
    it('坏日期不可', () => {
        expect(canCheckIn('confirmed', 'bad', co, '2026-10-10')).toBe(false);
    });
});

describe('dailyTransition（日常流转判定矩阵）', () => {
    const co = '2026-10-13';
    it('checkedIn：离店日当天与之后 → completed', () => {
        expect(dailyTransition('checkedIn', co, '2026-10-13')).toBe('completed');
        expect(dailyTransition('checkedIn', co, '2026-10-14')).toBe('completed');
    });
    it('checkedIn：未到离店日 → null', () => {
        expect(dailyTransition('checkedIn', co, '2026-10-12')).toBeNull();
    });
    it('confirmed：离店日当天仍不动（留人工核销窗口），过离店日 → noShow', () => {
        expect(dailyTransition('confirmed', co, '2026-10-13')).toBeNull();
        expect(dailyTransition('confirmed', co, '2026-10-14')).toBe('noShow');
    });
    it('其余状态一律 null', () => {
        expect(dailyTransition('pendingDeposit', co, '2026-10-14')).toBeNull();
        expect(dailyTransition('completed', co, '2026-10-14')).toBeNull();
        expect(dailyTransition('cancelled', co, '2026-10-14')).toBeNull();
        expect(dailyTransition('noShow', co, '2026-10-14')).toBeNull();
    });
    it('坏离店日期 → null', () => {
        expect(dailyTransition('checkedIn', 'bad', '2026-10-14')).toBeNull();
    });
});

describe('hotelDatesOfLine', () => {
    it('完整日期段返回 {checkIn, checkOut}', () => {
        expect(hotelDatesOfLine({ hotelCheckIn: '2026-10-10', hotelCheckOut: '2026-10-12' })).toEqual({
            checkIn: '2026-10-10',
            checkOut: '2026-10-12',
        });
    });
    it('缺失/不完整/非法 → null（非酒店行零侵入）', () => {
        expect(hotelDatesOfLine(null)).toBeNull();
        expect(hotelDatesOfLine({})).toBeNull();
        expect(hotelDatesOfLine({ hotelCheckIn: '2026-10-10' })).toBeNull();
        expect(hotelDatesOfLine({ hotelCheckIn: 'bad', hotelCheckOut: '2026-10-12' })).toBeNull();
    });
});

describe('bookingTotalCent（成交总额口径）', () => {
    it('prunedLinePriceWithTax（促销分摊后行价）优先', () => {
        expect(bookingTotalCent({ prunedLinePriceWithTax: 10000, linePriceWithTax: 5000, quantity: 3 })).toBe(10000);
    });
    it('无 pruned 回退 linePriceWithTax × quantity', () => {
        expect(bookingTotalCent({ linePriceWithTax: 5000, quantity: 2 })).toBe(10000);
    });
    it('quantity 缺失按 1', () => {
        expect(bookingTotalCent({ linePriceWithTax: 5000 })).toBe(5000);
    });
    it('无价格数据 → 0', () => {
        expect(bookingTotalCent({})).toBe(0);
        expect(bookingTotalCent({ prunedLinePriceWithTax: null, linePriceWithTax: null })).toBe(0);
    });
});

describe('HOTEL_ORDER_PENDING_STATES（确认口径依赖的订单状态集合）', () => {
    it('包含 ArrangingPayment / PartiallyPaid / PaymentSettled / OrderPlaced，不含终态', () => {
        expect(HOTEL_ORDER_PENDING_STATES).toEqual([
            'ArrangingPayment',
            'PartiallyPaid',
            'PaymentSettled',
            'OrderPlaced',
        ]);
        expect(HOTEL_ORDER_PENDING_STATES).not.toContain('Cancelled');
        expect(HOTEL_ORDER_PENDING_STATES).not.toContain('AddingItems');
    });
});
