import { describe, expect, it } from 'vitest';

import { aggregateByBin, aggregateByCounter, parseStateFilter, type StatLine } from './stocktake-math';

describe('parseStateFilter（规格 §7.1）', () => {
    it('state 单值优先于 states', () => {
        expect(parseStateFilter({ state: 'OPEN', states: ['POSTED'] }))
            .toEqual({ mode: 'one', values: ['OPEN'] });
    });

    it('无 state 时用 states 多值，并过滤空串与空白', () => {
        expect(parseStateFilter({ states: ['POSTED', '', '  ', 'CANCELLED'] }))
            .toEqual({ mode: 'many', values: ['POSTED', 'CANCELLED'] });
    });

    it('都为空 → 不过滤', () => {
        expect(parseStateFilter({})).toEqual({ mode: 'none', values: [] });
        expect(parseStateFilter({ states: [] })).toEqual({ mode: 'none', values: [] });
        expect(parseStateFilter({ state: '', states: [] })).toEqual({ mode: 'none', values: [] });
    });
});

const line = (p: Partial<StatLine>): StatLine => ({
    waveId: 1, zoneId: null, zoneCode: null, binId: null, binCode: null,
    isExtra: false, countedQty: null, countedById: null, countedByName: null, countedAt: null, ...p,
});

describe('aggregateByBin（规格 §7.3）', () => {
    it('按 (zoneId, binId) 分组；未归位行单列并置末；已盘要求 countedQty !== null', () => {
        const rows = aggregateByBin([
            line({ zoneId: 7, zoneCode: 'A', binId: 71, binCode: 'A-01', countedQty: 5 }),
            line({ zoneId: 7, zoneCode: 'A', binId: 71, binCode: 'A-01' }),          // 未盘
            line({ zoneId: 7, zoneCode: 'A', binId: 71, binCode: 'A-01', isExtra: true, countedQty: 2 }),
            line({ zoneId: 8, zoneCode: 'B', binId: 81, binCode: 'B-01', countedQty: 1 }),
            line({ countedQty: 3 }),                                                // 未归位
        ]);
        expect(rows.map((r) => [r.zoneCode, r.binCode, r.expectedLines, r.countedLines, r.uncountedLines, r.extraLines]))
            .toEqual([
                ['A', 'A-01', 2, 1, 1, 1],
                ['B', 'B-01', 1, 1, 0, 0],
                [null, null, 1, 1, 0, 0],
            ]);
    });

    it('同变体多行不做合并（只数作业量，不摊差异）', () => {
        const rows = aggregateByBin([
            line({ zoneId: 1, zoneCode: 'A', binId: 11, binCode: 'A-01', countedQty: 1 }),
            line({ zoneId: 1, zoneCode: 'A', binId: 11, binCode: 'A-01', countedQty: 9 }),
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].expectedLines).toBe(2);
        expect(rows[0].countedLines).toBe(2);
    });
});

describe('aggregateByCounter（规格 §7.3）', () => {
    it('只统计已盘行；按 countedLines 降序；waveCount 去重；lastCountedAt 取最大', () => {
        const rows = aggregateByCounter([
            line({ waveId: 1, countedQty: 1, countedById: 'm1', countedByName: '张三', countedAt: new Date('2026-09-01T10:00:00Z') }),
            line({ waveId: 2, countedQty: 1, countedById: 'm1', countedByName: '张三', countedAt: new Date('2026-09-02T10:00:00Z') }),
            line({ waveId: 2, countedQty: 1, isExtra: true, countedById: 'm1', countedByName: '张三', countedAt: new Date('2026-09-02T11:00:00Z') }),
            line({ waveId: 3, countedQty: 1, countedById: 'm2', countedByName: '李四', countedAt: new Date('2026-09-03T10:00:00Z') }),
            line({ waveId: 3 }),   // 未盘 → 不计入
        ]);
        expect(rows.map((r) => [r.countedByName, r.countedLines, r.extraLines, r.waveCount]))
            .toEqual([['张三', 3, 1, 2], ['李四', 1, 0, 1]]);
        expect(rows[0].lastCountedAt).toEqual(new Date('2026-09-02T11:00:00Z'));
    });

    it('countedById 为空的行归「未知」组（输出 null）', () => {
        const rows = aggregateByCounter([line({ countedQty: 4 })]);
        expect(rows).toEqual([{ countedById: null, countedByName: null, countedLines: 1, extraLines: 0, waveCount: 1, lastCountedAt: null }]);
    });

    it('零行（DRAFT / 空任务）返回空数组而不是抛错（规格 §9）', () => {
        expect(aggregateByBin([])).toEqual([]);
        expect(aggregateByCounter([])).toEqual([]);
    });
});