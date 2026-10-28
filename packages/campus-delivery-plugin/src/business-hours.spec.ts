import { describe, expect, it } from 'vitest';
import { campusNowMinutes, isWithinBusinessHours, nextBusinessTransition, parseBusinessHours } from './business-hours';

/** 构造某校园时刻的 UTC 毫秒（UTC+8） */
const atCampus = (h: number, m: number) => Date.UTC(2026, 0, 15, h - 8, m);

describe('parseBusinessHours', () => {
    it('解析单时段（全角冒号/连接符归一）', () => {
        expect(parseBusinessHours('10：00–22：00')).toEqual([{ start: 600, end: 1320 }]);
    });

    it('解析多时段（中英文逗号/顿号）', () => {
        expect(parseBusinessHours('10:00-14:00，17:00-21:00、22:00~23:00')).toEqual([
            { start: 600, end: 840 },
            { start: 1020, end: 1260 },
            { start: 1320, end: 1380 },
        ]);
    });

    it('跨零点时段结束时间 +1440', () => {
        expect(parseBusinessHours('18:00-02:00')).toEqual([{ start: 1080, end: 1560 }]);
    });

    it('无法解析返回空数组', () => {
        expect(parseBusinessHours('营业中')).toEqual([]);
        expect(parseBusinessHours(null)).toEqual([]);
    });
});

describe('isWithinBusinessHours', () => {
    it('未配置营业时间视为营业', () => {
        expect(isWithinBusinessHours(null, atCampus(3, 0))).toBe(true);
        expect(isWithinBusinessHours('', atCampus(3, 0))).toBe(true);
    });

    it('时段内返回 true，时段外返回 false', () => {
        expect(isWithinBusinessHours('10:00-22:00', atCampus(12, 0))).toBe(true);
        expect(isWithinBusinessHours('10:00-22:00', atCampus(22, 0))).toBe(false);
        expect(isWithinBusinessHours('10:00-22:00', atCampus(9, 59))).toBe(false);
    });

    it('午休多时段：午休时间视为打烊', () => {
        const hours = '10:00-14:00,17:00-21:00';
        expect(isWithinBusinessHours(hours, atCampus(12, 0))).toBe(true);
        expect(isWithinBusinessHours(hours, atCampus(15, 0))).toBe(false);
        expect(isWithinBusinessHours(hours, atCampus(18, 0))).toBe(true);
    });

    it('跨零点：凌晨 1 点仍营业', () => {
        expect(isWithinBusinessHours('18:00-02:00', atCampus(1, 0))).toBe(true);
        expect(isWithinBusinessHours('18:00-02:00', atCampus(3, 0))).toBe(false);
    });

    it('按校园时区（UTC+8）换算，不随服务器时区漂移', () => {
        expect(campusNowMinutes(atCampus(12, 30))).toBe(750);
    });
});

describe('nextBusinessTransition', () => {
    it('未配置营业时间 → null（无自动切换）', () => {
        expect(nextBusinessTransition(null, atCampus(12, 0))).toBeNull();
        expect(nextBusinessTransition('', atCampus(12, 0))).toBeNull();
    });

    it('营业中：下一次是打烊', () => {
        expect(nextBusinessTransition('10:00-21:00', atCampus(20, 30))).toEqual({
            action: 'close', at: '21:00', inMinutes: 30, today: true,
        });
    });

    it('打烊后：下一次开门（今天晚市 / 明天早市）', () => {
        const hours = '10:00-14:00,17:00-21:00';
        expect(nextBusinessTransition(hours, atCampus(15, 0))).toEqual({
            action: 'open', at: '17:00', inMinutes: 120, today: true,
        });
        expect(nextBusinessTransition(hours, atCampus(22, 0))).toEqual({
            action: 'open', at: '10:00', inMinutes: 720, today: false,
        });
    });

    it('跨零点时段：凌晨 1 点时下一次是 2 点打烊', () => {
        expect(nextBusinessTransition('18:00-02:00', atCampus(1, 0))).toEqual({
            action: 'close', at: '02:00', inMinutes: 60, today: true,
        });
        // 凌晨 3 点（已打烊）下一次是当天 18:00 开门
        expect(nextBusinessTransition('18:00-02:00', atCampus(3, 0))).toEqual({
            action: 'open', at: '18:00', inMinutes: 900, today: true,
        });
    });

    it('刚好到点：跳过当前时刻，取下一个边界', () => {
        // 21:00 整点打烊后立刻检查 → 次日 10:00 开门
        expect(nextBusinessTransition('10:00-21:00', atCampus(21, 0))).toEqual({
            action: 'open', at: '10:00', inMinutes: 780, today: false,
        });
    });
});
