// 排班时段判断单测：正常时段/跨零点/非法时间/时区边界
import { describe, expect, it } from 'vitest';
import { addDays, localDateKey, parseHm, shiftCoversNow } from './rider-shift-window';

// 北京时间 2026-10-25 23:30 → UTC 15:30
const at = (iso: string) => new Date(iso);

describe('rider-shift-window', () => {
    it('校园时区日期键与分钟数按 UTC+8 计算', () => {
        expect(localDateKey(at('2026-10-25T15:30:00.000Z'))).toBe('2026-10-25');
        expect(localDateKey(at('2026-10-25T16:30:00.000Z'))).toBe('2026-10-26');
        expect(localDateKey(at('2026-10-25T16:30:00.000Z'), 0)).toBe('2026-10-25');
    });

    it('日期键跨月/跨年偏移正确', () => {
        expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    });

    it('HH:mm 解析：合法/非法', () => {
        expect(parseHm('08:30')).toBe(510);
        expect(parseHm(' 22:00 ')).toBe(1320);
        expect(parseHm('24:00')).toBeNull();
        expect(parseHm('12:60')).toBeNull();
        expect(parseHm('abc')).toBeNull();
        expect(parseHm(null)).toBeNull();
    });

    it('当天班次：时段内 true，时段外 false', () => {
        const shift = { shiftDate: '2026-10-25', startTime: '08:00', endTime: '12:00' };
        expect(shiftCoversNow(shift, at('2026-10-25T00:00:00.000Z'))).toBe(true); // 08:00
        expect(shiftCoversNow(shift, at('2026-10-25T03:59:00.000Z'))).toBe(true); // 11:59
        expect(shiftCoversNow(shift, at('2026-10-25T04:00:00.000Z'))).toBe(false); // 12:00
        expect(shiftCoversNow(shift, at('2026-10-24T23:59:00.000Z'))).toBe(false); // 前一日 07:59
    });

    it('跨零点班次：开始日夜间与次日凌晨均有效', () => {
        const shift = { shiftDate: '2026-10-25', startTime: '22:00', endTime: '02:00' };
        expect(shiftCoversNow(shift, at('2026-10-25T14:30:00.000Z'))).toBe(true); // 22:30
        expect(shiftCoversNow(shift, at('2026-10-25T17:00:00.000Z'))).toBe(true); // 次日 01:00
        expect(shiftCoversNow(shift, at('2026-10-25T18:00:00.000Z'))).toBe(false); // 次日 02:00
        expect(shiftCoversNow(shift, at('2026-10-25T13:00:00.000Z'))).toBe(false); // 21:00
    });

    it('非法或空时段不生效（避免脏数据误放行/误拦截）', () => {
        expect(shiftCoversNow({ shiftDate: '2026-10-25', startTime: '', endTime: '12:00' }, at('2026-10-25T02:00:00.000Z'))).toBe(false);
        expect(shiftCoversNow({ shiftDate: '2026-10-25', startTime: '09:00', endTime: '09:00' }, at('2026-10-25T01:00:00.000Z'))).toBe(false);
    });
});
