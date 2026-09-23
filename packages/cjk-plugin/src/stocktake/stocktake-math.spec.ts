// src/stocktake/stocktake-math.spec.ts
import { describe, expect, it } from 'vitest';
import {
    buildExpected, buildPostItems, canTaskTransition, canWaveTransition,
    formatTaskCode, nextTaskSeq, resolveScanCode, resolveTaskStateAfterWaves,
    resolveWaveStateAfterCount, summarizeVariance, variantSnapBook, waveOwnerError,
} from './stocktake-math';

describe('任务/盘次状态机', () => {
    it('任务：DRAFT → OPEN → COUNTING → COUNTED → POSTED 合法，跳级与终态出边非法', () => {
        expect(canTaskTransition('DRAFT', 'OPEN')).toBe(true);
        expect(canTaskTransition('OPEN', 'COUNTING')).toBe(true);
        expect(canTaskTransition('COUNTING', 'COUNTED')).toBe(true);
        expect(canTaskTransition('COUNTED', 'POSTED')).toBe(true);
        expect(canTaskTransition('DRAFT', 'COUNTING')).toBe(false);
        expect(canTaskTransition('POSTED', 'COUNTING')).toBe(false);
        expect(canTaskTransition('CANCELLED', 'OPEN')).toBe(false);
    });

    it('任务：任意非终态可取消，终态不可取消', () => {
        for (const s of ['DRAFT', 'OPEN', 'COUNTING', 'COUNTED'] as const) {
            expect(canTaskTransition(s, 'CANCELLED')).toBe(true);
        }
        expect(canTaskTransition('POSTED', 'CANCELLED')).toBe(false);
        expect(canTaskTransition('CANCELLED', 'CANCELLED')).toBe(false);
    });

    it('盘次：OPEN → CLAIMED → COUNTING → SUBMITTED；释放回到 OPEN；SUBMITTED 后不可再变', () => {
        expect(canWaveTransition('OPEN', 'CLAIMED')).toBe(true);
        expect(canWaveTransition('CLAIMED', 'COUNTING')).toBe(true);
        expect(canWaveTransition('COUNTING', 'SUBMITTED')).toBe(true);
        expect(canWaveTransition('CLAIMED', 'OPEN')).toBe(true);   // 释放
        expect(canWaveTransition('COUNTING', 'OPEN')).toBe(true);  // 释放
        expect(canWaveTransition('SUBMITTED', 'OPEN')).toBe(false);
        expect(canWaveTransition('SUBMITTED', 'COUNTING')).toBe(false);
    });

    it('任务号：TK + 日期 + 三位流水，且取当日最大流水 +1', () => {
        const now = new Date('2026-09-23T10:00:00+08:00');
        expect(formatTaskCode(now, 7)).toBe('TK20260923-007');
        expect(nextTaskSeq([], now)).toBe(1);
        expect(nextTaskSeq(['TK20260923-001', 'TK20260923-003'], now)).toBe(4);
        expect(nextTaskSeq(['TK20260922-009', 'TK20260923-002'], now)).toBe(3);
    });
});

describe('应盘清单生成（规格 §6.1）', () => {
    const variantMeta = new Map([
        [11, { sku: 'SKU-A', name: '甲商品' }],
        [22, { sku: 'SKU-B', name: '乙商品' }],
        [33, { sku: 'SKU-C', name: '丙商品' }],
    ]);
    const zoneMeta = new Map([
        [1, { code: 'A', name: 'A 区' }],
        [2, { code: 'B', name: 'B 区' }],
    ]);
    const scope = { zones: [], categoryIds: [], variantIds: [], includeZeroBook: false };

    it('binMode=off：只建一个 whole 盘次，全部行库位为空', () => {
        const r = buildExpected({
            binMode: 'off',
            bookRows: [{ variantId: 11, quantity: 5 }, { variantId: 22, quantity: 3 }],
            bindRows: [{ variantId: 11, zoneId: 1, binId: 101 }],
            variantMeta, zoneMeta, scope,
        });
        expect(r.waves).toHaveLength(1);
        expect(r.waves[0].scopeType).toBe('whole');
        expect(r.waves[0].expectedCount).toBe(2);
        expect(r.linesByWave[0].every((l) => l.zoneId === null && l.binId === null)).toBe(true);
    });

    it('binMode=bin：已归位按 (zone,bin) 拆行 + 未归位进 unassigned 桶（双源合并）', () => {
        const r = buildExpected({
            binMode: 'bin',
            bookRows: [{ variantId: 11, quantity: 5 }, { variantId: 22, quantity: 3 }],
            bindRows: [
                { variantId: 11, zoneId: 1, binId: 101, zoneCode: 'A', binCode: 'A-01-01' },
                { variantId: 33, zoneId: 2, binId: 201, zoneCode: 'B', binCode: 'B-01-01' },
            ],
            variantMeta, zoneMeta, scope,
        });
        const byType = (t: string) => r.waves.findIndex((w) => w.scopeType === t);
        // 按库区拆盘次（规格 §1.1 / Task 4 验收）：2 个库区 → 2 个 zone 盘次；未归位桶排在最后
        expect(r.waves.map((w) => w.scopeType)).toEqual(['zone', 'zone', 'unassigned']);
        expect(byType('zone')).toBe(0);
        expect(byType('unassigned')).toBe(2);
        expect(r.waves[0].zoneId).toBe(1);
        expect(r.waves[1].zoneId).toBe(2);
        expect(r.linesByWave[0].map((l) => l.variantId)).toEqual([11]); // 库区 1 的归位行
        expect(r.linesByWave[1].map((l) => l.variantId)).toEqual([33]); // 库区 2 的归位行
        // 变体 22 只有账面、无绑定 → 未归位桶
        const unassigned = r.linesByWave[2];
        expect(unassigned.map((l) => l.variantId)).toEqual([22]);
        expect(unassigned[0].bookQty).toBe(3);
        expect(unassigned[0].zoneId).toBeNull();
    });

    it('binMode=bin：同一变体多绑定 → 多行，且每行 bookQty 相同（行内提示，不参与相减）', () => {
        const r = buildExpected({
            binMode: 'bin',
            bookRows: [{ variantId: 11, quantity: 5 }],
            bindRows: [
                { variantId: 11, zoneId: 1, binId: 101 },
                { variantId: 11, zoneId: 1, binId: 102 },
            ],
            variantMeta, zoneMeta, scope,
        });
        expect(r.linesByWave[0]).toHaveLength(2);
        expect(r.linesByWave[0].map((l) => l.bookQty)).toEqual([5, 5]);
        // 同变体多条绑定 → 同变体多行，但 variantId 相同（差异计算必须按变体汇总）
        expect(r.linesByWave[0].map((l) => l.variantId)).toEqual([11, 11]);
    });

    it('同变体多账面行按 variantId 归并求和；includeZeroBook=false 时 0 库存不入清单', () => {
        const r = buildExpected({
            binMode: 'off',
            bookRows: [{ variantId: 11, quantity: 2 }, { variantId: 11, quantity: 3 }, { variantId: 22, quantity: 0 }],
            bindRows: [], variantMeta, zoneMeta, scope,
        });
        expect(r.linesByWave[0]).toHaveLength(1);
        expect(r.linesByWave[0][0].bookQty).toBe(5);
    });

    it('scope.variantIds 限定变体集合（专项盘）；scope.zones 之外的绑定退入未归位桶而不丢行', () => {
        const r = buildExpected({
            binMode: 'bin',
            bookRows: [{ variantId: 11, quantity: 5 }, { variantId: 22, quantity: 3 }],
            bindRows: [
                { variantId: 11, zoneId: 2, binId: 201 },
                { variantId: 22, zoneId: 1, binId: 101 },
            ],
            variantMeta, zoneMeta,
            scope: { ...scope, zones: [1], variantIds: [22] },
        });
        expect(r.waves.map((w) => w.scopeType)).toEqual(['zone']);
        expect(r.linesByWave[0].map((l) => l.variantId)).toEqual([22]);
    });

    it('zone 档绑定只有 zoneId（binId 为 null）时行与盘次仍正确', () => {
        const r = buildExpected({
            binMode: 'zone',
            bookRows: [{ variantId: 11, quantity: 5 }],
            bindRows: [{ variantId: 11, zoneId: 1, binId: null }],
            variantMeta, zoneMeta, scope,
        });
        expect(r.waves[0].scopeType).toBe('zone');
        expect(r.waves[0].zoneCode).toBe('A');
        expect(r.linesByWave[0][0].binId).toBeNull();
    });
});

describe('差异汇总（规格 §6.2，R11 按变体汇总）', () => {
    const currentBook = [{ variantId: 11, quantity: 4 }];

    it('同一变体多行 → 汇总相减，绝不逐行相减', () => {
        const r = summarizeVariance(
            [
                { id: 1, variantId: 11, countedQty: 3, isExtra: false, bookQty: 4, zoneId: 1, binId: 101 },
                { id: 2, variantId: 11, countedQty: 2, isExtra: false, bookQty: 4, zoneId: 1, binId: 102 },
            ],
            currentBook,
            [{ variantId: 11, zoneId: 1, binId: 101 }],
        );
        expect(r.byVariant).toHaveLength(1);
        expect(r.byVariant[0].countedTotal).toBe(5);
        expect(r.byVariant[0].diff).toBe(1); // 5 - 4，不是 (3-4)+(2-4)
    });

    it('盘盈行计入实盘、账面按 0；整变体未盘不进差异（账面不变）', () => {
        const r = summarizeVariance(
            [
                { id: 1, variantId: 11, countedQty: null, isExtra: false, bookQty: 4, zoneId: 1, binId: 101 },
                { id: 2, variantId: 22, countedQty: 2, isExtra: true, bookQty: 0, zoneId: null, binId: null },
            ],
            currentBook,
            [],
        );
        expect(r.uncountedLineIds).toEqual([1]);
        expect(r.extraLineIds).toEqual([2]);
        expect(r.byVariant.map((v) => v.variantId)).toEqual([22]);
        const v22 = r.byVariant.find((v) => v.variantId === 22)!;
        expect(v22.diff).toBe(2);
    });

    it('同一变体部分行未盘 → 仍按已盘行过账（未盘行不参与合计）', () => {
        const r = summarizeVariance(
            [
                { id: 1, variantId: 11, countedQty: 3, isExtra: false, bookQty: 4, zoneId: 1, binId: 101 },
                { id: 2, variantId: 11, countedQty: null, isExtra: false, bookQty: 4, zoneId: 1, binId: 102 },
            ],
            currentBook,
            [],
        );
        expect(r.byVariant.map((v) => v.variantId)).toEqual([11]);
        expect(r.byVariant[0].countedTotal).toBe(3);
        expect(r.byVariant[0].diff).toBe(-1);
        expect(r.uncountedCount).toBe(1);
    });

    it('账面快照与当前账面不一致 → recheck 并列出变动变体', () => {
        const r = summarizeVariance(
            [{ id: 1, variantId: 11, countedQty: 4, isExtra: false, bookQty: 5, zoneId: 1, binId: 101 }],
            currentBook,
            [{ variantId: 11, zoneId: 1, binId: 101 }],
        );
        expect(r.recheck).toBe(true);
        expect(r.changedVariants).toEqual([{ variantId: 11, snapBookQty: 5, currentBookQty: 4 }]);
        expect(r.byVariant).toHaveLength(0); // 以当前账面重算后无差异、无归位变更 → 不进差异行（改由 changedVariants 提示）
    });

    it('实盘所在格 ≠ 当前绑定 → binChanged（过账时顺手归位）', () => {
        const r = summarizeVariance(
            [{ id: 1, variantId: 11, countedQty: 4, isExtra: false, bookQty: 4, zoneId: 1, binId: 999 }],
            currentBook,
            [{ variantId: 11, zoneId: 1, binId: 101 }],
        );
        expect(r.byVariant[0].diff).toBe(0);
        expect(r.byVariant[0].binChanged).toBe(true);
        expect(r.byVariant[0].targetBinId).toBe(999);
    });

    it('variantSnapBook 取非盘盈行的账面快照', () => {
        const m = variantSnapBook([
            { id: 1, variantId: 11, countedQty: null, isExtra: false, bookQty: 7, zoneId: null, binId: null },
            { id: 2, variantId: 11, countedQty: 1, isExtra: true, bookQty: 0, zoneId: null, binId: null },
        ]);
        expect(m.get(11)).toBe(7);
    });
});

describe('过账计划（规格 §6.3）', () => {
    it('只对有差异或库位变更的变体生成项；无变化不生成', () => {
        const summary = summarizeVariance(
            [
                { id: 1, variantId: 11, countedQty: 6, isExtra: false, bookQty: 4, zoneId: 1, binId: 101 },
                { id: 2, variantId: 22, countedQty: 3, isExtra: false, bookQty: 3, zoneId: 1, binId: 102 },
                { id: 3, variantId: 33, countedQty: 2, isExtra: true, bookQty: 0, zoneId: null, binId: null },
            ],
            [{ variantId: 11, quantity: 4 }, { variantId: 22, quantity: 3 }],
            [{ variantId: 11, zoneId: 1, binId: 101 }, { variantId: 22, zoneId: 1, binId: 102 }],
        );
        const plan = buildPostItems({ summary, stockLocationId: 5 });
        expect(plan.items.map((i) => i.variantId).sort()).toEqual([11, 33]);
        expect(plan.items.find((i) => i.variantId === 11)).toEqual({
            variantId: 11, toStockLocationId: 5, realQty: 6, zoneId: 1, binId: 101,
        });
        expect(plan.items.find((i) => i.variantId === 33)!.realQty).toBe(2);
    });

    it('无差异但库位变更 → 生成项，realQty 取当前账面（触发归位而不动数量）', () => {
        const summary = summarizeVariance(
            [{ id: 1, variantId: 22, countedQty: 3, isExtra: false, bookQty: 3, zoneId: 2, binId: 201 }],
            [{ variantId: 22, quantity: 3 }],
            [{ variantId: 22, zoneId: 1, binId: 101 }],
        );
        const plan = buildPostItems({ summary, stockLocationId: 5 });
        expect(plan.items).toHaveLength(1);
        expect(plan.items[0]).toEqual({
            variantId: 22, toStockLocationId: 5, realQty: 3, zoneId: 2, binId: 201,
        });
    });
});

describe('状态派生与独占锁（规格 §5/§3.6）', () => {
    it('盘次有录入即进入 COUNTING；已 SUBMITTED 不回退', () => {
        expect(resolveWaveStateAfterCount('OPEN', 1)).toBe('COUNTING');
        expect(resolveWaveStateAfterCount('CLAIMED', 2)).toBe('COUNTING');
        expect(resolveWaveStateAfterCount('SUBMITTED', 2)).toBe('SUBMITTED');
        expect(resolveWaveStateAfterCount('CANCELLED', 0)).toBe('CANCELLED');
    });

    it('全部盘次 SUBMITTED/CANCELLED → 任务 COUNTED；仍有未提交 → COUNTING', () => {
        expect(resolveTaskStateAfterWaves('OPEN', [{ state: 'SUBMITTED' }, { state: 'CANCELLED' }])).toBe('COUNTED');
        expect(resolveTaskStateAfterWaves('COUNTING', [{ state: 'SUBMITTED' }, { state: 'COUNTING' }])).toBe('COUNTING');
        expect(resolveTaskStateAfterWaves('COUNTED', [{ state: 'SUBMITTED' }, { state: 'OPEN' }])).toBe('COUNTING');
        expect(resolveTaskStateAfterWaves('POSTED', [{ state: 'SUBMITTED' }])).toBe('POSTED');
        expect(resolveTaskStateAfterWaves('OPEN', [])).toBe('OPEN');
    });

    it('非负责人操作 → 回传含负责人姓名的原因；无人认领 → 要求先认领', () => {
        expect(waveOwnerError(null, '12', '张三')).toContain('认领');
        expect(waveOwnerError('12', '12', '张三')).toBeNull();
        expect(waveOwnerError('12', '99', '张三')).toContain('张三');
    });
});

describe('扫码解析（规格 §8.3 优先级）', () => {
    const ctx = {
        bins: [{ binId: 101, binCode: 'A-01-01', zoneId: 1 }],
        lines: [{ lineId: 7, variantId: 11, sku: 'SKU-A', barcode: '6901111111111', internalCode: 'IN-A' }],
        variants: [{ variantId: 99, sku: 'SKU-X', barcode: '6909999999999', internalCode: 'IN-X' }],
    };

    it('库位码优先：切格', () => {
        expect(resolveScanCode('A-01-01', ctx)).toEqual({ kind: 'bin', binId: 101, binCode: 'A-01-01', zoneId: 1 });
    });

    it('内部码 / 条形码 / SKU 均能命中断行', () => {
        expect(resolveScanCode('IN-A', ctx)).toMatchObject({ kind: 'line', lineId: 7, variantId: 11 });
        expect(resolveScanCode('6901111111111', ctx)).toMatchObject({ kind: 'line', lineId: 7, variantId: 11 });
        expect(resolveScanCode('SKU-A', ctx)).toMatchObject({ kind: 'line', lineId: 7, variantId: 11 });
    });

    it('清单内变体优先于清单外同码变体（避免误判盘盈）', () => {
        const dup = {
            bins: ctx.bins,
            lines: [{ lineId: 7, variantId: 11, sku: 'DUP', barcode: null, internalCode: null }],
            variants: [{ variantId: 99, sku: 'DUP', barcode: null, internalCode: null }],
        };
        expect(resolveScanCode('DUP', dup)).toMatchObject({ kind: 'line', lineId: 7 });
    });

    it('清单外但可识别变体 → extra（允许登记盘盈）', () => {
        expect(resolveScanCode('6909999999999', ctx)).toMatchObject({ kind: 'extra', variantId: 99, sku: 'SKU-X' });
    });

    it('完全无法识别 → none（前端提示条码未登记）', () => {
        expect(resolveScanCode('XXX-UNKNOWN', ctx)).toEqual({ kind: 'none', raw: 'XXX-UNKNOWN' });
        expect(resolveScanCode('   ', ctx)).toEqual({ kind: 'none', raw: '' });
    });
});