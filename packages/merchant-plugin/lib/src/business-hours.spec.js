"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const business_hours_1 = require("./business-hours");
const SHANGHAI = 'Asia/Shanghai';
(0, vitest_1.describe)('parseBusinessHours', () => {
    (0, vitest_1.it)('解析单段营业时间并生成每周同值', () => {
        var _a, _b;
        const hours = (0, business_hours_1.parseBusinessHours)('09:00-21:00');
        (0, vitest_1.expect)(hours.weekly).toHaveLength(7);
        (0, vitest_1.expect)((_a = hours.weekly) === null || _a === void 0 ? void 0 : _a[0]).toEqual({ day: 0, periods: [{ start: '09:00', end: '21:00' }] });
        (0, vitest_1.expect)((_b = hours.weekly) === null || _b === void 0 ? void 0 : _b[6].periods).toEqual([{ start: '09:00', end: '21:00' }]);
    });
    (0, vitest_1.it)('解析多段营业时间', () => {
        var _a;
        const hours = (0, business_hours_1.parseBusinessHours)('09:00-12:00,13:00-18:00');
        (0, vitest_1.expect)((_a = hours.weekly) === null || _a === void 0 ? void 0 : _a[3].periods).toEqual([
            { start: '09:00', end: '12:00' },
            { start: '13:00', end: '18:00' },
        ]);
    });
    (0, vitest_1.it)('结构化数据优先于文本', () => {
        const hours = (0, business_hours_1.parseBusinessHours)({ weekly: [{ day: 1, periods: [{ start: '08:00', end: '10:00' }] }] }, '09:00-21:00');
        (0, vitest_1.expect)(hours.weekly).toEqual([{ day: 1, periods: [{ start: '08:00', end: '10:00' }] }]);
    });
});
(0, vitest_1.describe)('isOpenAt', () => {
    (0, vitest_1.it)('常规 09:00-21:00', () => {
        const source = { businessHoursText: '09:00-21:00', timezone: SHANGHAI };
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)(source, new Date('2026-10-26T10:00:00+08:00'))).toBe(true);
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)(source, new Date('2026-10-26T21:00:00+08:00'))).toBe(false);
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)(source, new Date('2026-10-26T22:00:00+08:00'))).toBe(false);
    });
    (0, vitest_1.it)('跨天 18:00-02:00', () => {
        const source = { businessHoursText: '18:00-02:00', timezone: SHANGHAI };
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)(source, new Date('2026-10-26T23:00:00+08:00'))).toBe(true);
        // 次日凌晨仍在营业（当地星期已切到次日，但时段按分钟判定）
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)(source, new Date('2026-10-27T01:00:00+08:00'))).toBe(true);
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)(source, new Date('2026-10-26T12:00:00+08:00'))).toBe(false);
    });
    (0, vitest_1.it)('特殊日闭店优先于每周营业', () => {
        const source = {
            businessHours: {
                weekly: [{ day: 1, periods: [{ start: '09:00', end: '21:00' }] }],
                specialDates: [{ date: '2026-10-26', closed: true }],
            },
            timezone: SHANGHAI,
        };
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)(source, new Date('2026-10-26T10:00:00+08:00'))).toBe(false);
    });
    (0, vitest_1.it)('每周固定闭店', () => {
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
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)(source, new Date('2026-10-25T12:00:00+08:00'))).toBe(false);
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)(source, new Date('2026-10-26T12:00:00+08:00'))).toBe(true);
    });
    (0, vitest_1.it)('未配置营业时间时视为营业', () => {
        (0, vitest_1.expect)((0, business_hours_1.isOpenAt)({ timezone: SHANGHAI }, new Date('2026-10-26T03:00:00+08:00'))).toBe(true);
    });
});
(0, vitest_1.describe)('formatBusinessHoursText', () => {
    (0, vitest_1.it)('输出单段营业时间文案', () => {
        (0, vitest_1.expect)((0, business_hours_1.formatBusinessHoursText)('09:00-21:00')).toBe('09:00-21:00');
    });
    (0, vitest_1.it)('无法解析时回退 fallback', () => {
        (0, vitest_1.expect)((0, business_hours_1.formatBusinessHoursText)('', '详询门店')).toBe('详询门店');
    });
});
//# sourceMappingURL=business-hours.spec.js.map