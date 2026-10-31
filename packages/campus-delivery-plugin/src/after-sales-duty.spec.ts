import { describe, expect, it } from 'vitest';
import { dutyAssigneeAt, normalizeDutyEntries } from './after-sales-duty';

// 2026-10-01 为周四（weekday=4），校园时区 UTC+8
const THU_10AM = new Date('2026-10-01T10:00:00+08:00').getTime();
const THU_23PM = new Date('2026-10-01T23:00:00+08:00').getTime();
const FRI_2AM = new Date('2026-10-02T01:00:00+08:00').getTime();

describe('dutyAssigneeAt（§100 值班排班）', () => {
    it('命中当日区间返回值班人', () => {
        expect(dutyAssigneeAt([{ weekday: 4, startMin: 540, endMin: 1260, userId: 7 }], THU_10AM)).toBe(7);
    });

    it('区间外返回 null', () => {
        expect(dutyAssigneeAt([{ weekday: 4, startMin: 540, endMin: 1260, userId: 7 }], THU_23PM)).toBeNull();
    });

    it('跨零点区间：次日凌晨仍由前一日值班人负责', () => {
        expect(dutyAssigneeAt([{ weekday: 4, startMin: 1320, endMin: 1560, userId: 7 }], FRI_2AM)).toBe(7);
    });

    it('跨零点区间：次日白天不再命中', () => {
        const friNoon = new Date('2026-10-02T12:00:00+08:00').getTime();
        expect(dutyAssigneeAt([{ weekday: 4, startMin: 1320, endMin: 1560, userId: 7 }], friNoon)).toBeNull();
    });

    it('空表返回 null', () => {
        expect(dutyAssigneeAt([], THU_10AM)).toBeNull();
        expect(dutyAssigneeAt(null, THU_10AM)).toBeNull();
    });

    it('多条命中按顺序取第一条', () => {
        const got = dutyAssigneeAt(
            [
                { weekday: 4, startMin: 0, endMin: 1440, userId: 8 },
                { weekday: 4, startMin: 540, endMin: 1260, userId: 7 },
            ],
            THU_10AM,
        );
        expect(got).toBe(8);
    });
});

describe('normalizeDutyEntries（§100 值班表写入校验）', () => {
    it('合法条目归一化', () => {
        expect(normalizeDutyEntries([{ weekday: 4, startMin: 540, endMin: 1260, userId: 7 }])).toEqual([
            { weekday: 4, startMin: 540, endMin: 1260, userId: 7 },
        ]);
    });

    it('星期越界抛错', () => {
        expect(() => normalizeDutyEntries([{ weekday: 7, startMin: 0, endMin: 60, userId: 1 }])).toThrow();
    });

    it('值班人为空抛错', () => {
        expect(() => normalizeDutyEntries([{ weekday: 1, startMin: 0, endMin: 60, userId: 0 }])).toThrow();
    });

    it('开始时间越界抛错', () => {
        expect(() => normalizeDutyEntries([{ weekday: 1, startMin: 1440, endMin: 1440, userId: 1 }])).toThrow();
    });
});
