import { describe, expect, it } from 'vitest';
import { closedToday, normalizeClosureDates, safeClosureDates, nextClosure } from './closure-calendar';

/** 校园时区（UTC+8）当天某时刻的 epoch ms */
function atCampus(y: number, m: number, d: number, h = 0, mi = 0): number {
    return Date.UTC(y, m - 1, d, h - 8, mi);
}

const TODAY = atCampus(2026, 10, 29, 12, 0);

describe('normalizeClosureDates', () => {
    it('去重、升序、备注空串归一为 null', () => {
        const out = normalizeClosureDates(
            [
                { date: '2026-11-02', note: '  国庆假期  ' },
                { date: '2026-10-31', note: '' },
                { date: '2026-11-02', note: '国庆假期' },
            ],
            TODAY,
        );
        expect(out).toEqual([
            { date: '2026-10-31', note: null },
            { date: '2026-11-02', note: '国庆假期' },
        ]);
    });

    it('空值返回空数组', () => {
        expect(normalizeClosureDates(null, TODAY)).toEqual([]);
        expect(normalizeClosureDates([], TODAY)).toEqual([]);
    });

    it('拒绝非法格式 / 假日期 / 过去日期 / 超出 90 天 / 超长备注', () => {
        expect(() => normalizeClosureDates([{ date: '2026/11/01' }], TODAY)).toThrow('格式不合法');
        expect(() => normalizeClosureDates([{ date: '2026-02-30' }], TODAY)).toThrow('格式不合法');
        expect(() => normalizeClosureDates([{ date: '2026-10-28' }], TODAY)).toThrow('不能早于今天');
        expect(() => normalizeClosureDates([{ date: '2027-03-01' }], TODAY)).toThrow('最多提前 90 天');
        expect(() => normalizeClosureDates([{ date: '2026-11-01', note: 'x'.repeat(41) }], TODAY)).toThrow('备注');
        expect(() => normalizeClosureDates('not-array', TODAY)).toThrow('日期数组');
    });

    it('最多 30 条', () => {
        const list = Array.from({ length: 31 }, (_, i) => ({
            date: new Date(Date.UTC(2026, 9, 30 + i, 4)).toISOString().slice(0, 10),
        }));
        expect(() => normalizeClosureDates(list, TODAY)).toThrow('最多登记 30 条');
    });
});

describe('safeClosureDates', () => {
    it('脏数据与过去日期直接忽略，不抛错', () => {
        expect(safeClosureDates('oops', TODAY)).toEqual([]);
        expect(safeClosureDates([{ date: '2026-02-30' }, { date: '2026-10-01' }, { date: '2026-11-01' }], TODAY))
            .toEqual([{ date: '2026-11-01', note: null }]);
    });

    it('兼容 JSON 字符串存储', () => {
        expect(safeClosureDates('[{"date":"2026-11-01","note":"休整"}]', TODAY))
            .toEqual([{ date: '2026-11-01', note: '休整' }]);
    });
});

describe('closedToday / nextClosure', () => {
    const dates = [
        { date: '2026-10-29', note: '临时休业' },
        { date: '2026-11-01', note: '周末' },
    ];

    it('今天命中即休业；不命中为正常营业', () => {
        expect(closedToday(dates, TODAY)).toEqual({ date: '2026-10-29', note: '临时休业' });
        expect(closedToday(dates, atCampus(2026, 10, 30, 0, 30))).toBeNull();
        expect(closedToday(null, TODAY)).toBeNull();
    });

    it('跨零点后（校园时区 0 点）自动恢复', () => {
        expect(closedToday(dates, atCampus(2026, 10, 30, 0, 0))).toBeNull();
    });

    it('nextClosure 返回最近一条未来休业', () => {
        expect(nextClosure(dates, atCampus(2026, 10, 30, 9, 0))).toEqual({ date: '2026-11-01', note: '周末' });
        expect(nextClosure([], TODAY)).toBeNull();
    });
});
