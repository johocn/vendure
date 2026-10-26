import { describe, expect, it } from 'vitest';

import { formatBusinessHoursText, isOpenAt, parseBusinessHours } from './business-hours';

const SHANGHAI = 'Asia/Shanghai';

describe('parseBusinessHours', () => {
    it('解析单段营业时间并生成每周同值', () => {
        const hours = parseBusinessHours('09:00-21:00');
        expect(hours.weekly).toHaveLength(7);
        expect(hours.weekly?.[0]).toEqual({ day: 0, periods: [{ start: '09:00', end: '21:00' }] });
        expect(hours.weekly?.[6].periods).toEqual([{ start: '09:00', end: '21:00' }]);
    });

    it('解析多段营业时间', () => {
        const hours = parseBusinessHours('09:00-12:00,13:00-18:00');
        expect(hours.weekly?.[3].periods).toEqual([
            { start: '09:00', end: '12:00' },
            { start: '13:00', end: '18:00' },
        ]);
    });

    it('结构化数据优先于文本', () => {
        const hours = parseBusinessHours(
            { weekly: [{ day: 1, periods: [{ start: '08:00', end: '10:00' }] }] },
            '09:00-21:00',
        );
        expect(hours.weekly).toEqual([{ day: 1, periods: [{ start: '08:00', end: '10:00' }] }]);
    });
});

describe('isOpenAt', () => {
    it('常规 09:00-21:00', () => {
        const source = { businessHoursText: '09:00-21:00', timezone: SHANGHAI };
        expect(isOpenAt(source, new Date('2026-10-26T10:00:00+08:00'))).toBe(true);
        expect(isOpenAt(source, new Date('2026-10-26T21:00:00+08:00'))).toBe(false);
        expect(isOpenAt(source, new Date('2026-10-26T22:00:00+08:00'))).toBe(false);
    });

    it('跨天 18:00-02:00', () => {
        const source = { businessHoursText: '18:00-02:00', timezone: SHANGHAI };
        expect(isOpenAt(source, new Date('2026-10-26T23:00:00+08:00'))).toBe(true);
        // 次日凌晨仍在营业（当地星期已切到次日，但时段按分钟判定）
        expect(isOpenAt(source, new Date('2026-10-27T01:00:00+08:00'))).toBe(true);
        expect(isOpenAt(source, new Date('2026-10-26T12:00:00+08:00'))).toBe(false);
    });

    it('特殊日闭店优先于每周营业', () => {
        const source = {
            businessHours: {
                weekly: [{ day: 1, periods: [{ start: '09:00', end: '21:00' }] }],
                specialDates: [{ date: '2026-10-26', closed: true }],
            },
            timezone: SHANGHAI,
        };
        expect(isOpenAt(source, new Date('2026-10-26T10:00:00+08:00'))).toBe(false);
    });

    it('每周固定闭店', () => {
        const source = {
            businessHours: {
                weekly: [
                    { day: 0, periods: [], closed: true },
                    { day: 1, periods: [{ start: '09:00', end: '21:00' }] },
                ],
            },
            timezone: SHANGHAI,
        };
        // 2026-10-25 为周日
        expect(isOpenAt(source, new Date('2026-10-25T12:00:00+08:00'))).toBe(false);
        expect(isOpenAt(source, new Date('2026-10-26T12:00:00+08:00'))).toBe(true);
    });

    it('未配置营业时间时视为营业', () => {
        expect(isOpenAt({ timezone: SHANGHAI }, new Date('2026-10-26T03:00:00+08:00'))).toBe(true);
    });
});

describe('formatBusinessHoursText', () => {
    it('输出单段营业时间文案', () => {
        expect(formatBusinessHoursText('09:00-21:00')).toBe('09:00-21:00');
    });

    it('无法解析时回退 fallback', () => {
        expect(formatBusinessHoursText('', '详询门店')).toBe('详询门店');
    });
});
