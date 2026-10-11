import { describe, expect, it } from 'vitest';

import { buildLayout } from '../layout';

const base = { count: 21, seed: 42 };

describe('buildLayout 确定性', () => {
    it('同输入两次输出完全一致（快照语义）', () => {
        const input = { ...base, pattern: 'random' as const, palette: ['x', 'y'], weights: [3, 1], materials: { main: 'x' } };
        expect(buildLayout(input)).toEqual(buildLayout(input));
    });

    it('angle = index/N·2π 且输出按 angle 升序', () => {
        const { beads } = buildLayout({ ...base, pattern: 'solid', materials: { main: 'x' } });
        expect(beads).toHaveLength(21);
        for (let i = 0; i < 21; i++) {
            expect(beads[i].angle).toBeCloseTo((i / 21) * 2 * Math.PI, 10);
        }
        for (let i = 1; i < 21; i++) {
            expect(beads[i].angle).toBeGreaterThanOrEqual(beads[i - 1].angle);
        }
        expect(beads[0].depth).toBeCloseTo(0.5, 10);
    });

    it('rotation 值域 [0, 2π) 且彼此不同（按珠序派生）', () => {
        const { beads } = buildLayout({ ...base, pattern: 'solid', materials: { main: 'x' } });
        const rots = beads.map(b => b.rotation);
        for (const r of rots) {
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThan(2 * Math.PI);
        }
        expect(new Set(rots).size).toBeGreaterThan(15);
    });

    it('solid：全部主珠', () => {
        const { beads } = buildLayout({ ...base, pattern: 'solid', materials: { main: 'x' } });
        expect(beads.every(b => b.materialId === 'x' && b.role === 'main')).toBe(true);
    });

    it('ab：ratio=2 时 [A,A,B] 周期', () => {
        const { beads } = buildLayout({ count: 6, seed: 1, pattern: 'ab', ratio: 2, materials: { main: 'a', secondary: 'b' } });
        expect(beads.map(b => b.materialId)).toEqual(['a', 'a', 'b', 'a', 'a', 'b']);
    });

    it('gradient：严格左右对称', () => {
        const { beads } = buildLayout({ count: 20, seed: 1, pattern: 'gradient', palette: ['deep', 'mid', 'light'], materials: { main: 'deep' } });
        for (let i = 0; i < 10; i++) {
            expect(beads[i].materialId).toBe(beads[19 - i].materialId);
        }
    });

    it('random：同材质不得连续 >3 颗', () => {
        const { beads } = buildLayout({ count: 60, seed: 7, pattern: 'random', palette: ['x', 'y'], weights: [5, 1], materials: { main: 'x' } });
        let run = 1;
        for (let i = 1; i < beads.length; i++) {
            run = beads[i].materialId === beads[i - 1].materialId ? run + 1 : 1;
            expect(run).toBeLessThanOrEqual(3);
        }
    });

    it('focal：index 0 是焦点珠且仅 1 颗', () => {
        const { beads } = buildLayout({ ...base, pattern: 'focal', materials: { main: 'x', focal: 'f' } });
        expect(beads[0].materialId).toBe('f');
        expect(beads.filter(b => b.materialId === 'f')).toHaveLength(1);
    });

    it('隔片：every=2 时隔片颗数 = floor(N/3) 且 role=spacer', () => {
        const { beads } = buildLayout({ ...base, pattern: 'solid', spacerEvery: 2, materials: { main: 'x', spacer: 's' } });
        const spacers = beads.filter(b => b.role === 'spacer');
        expect(spacers).toHaveLength(Math.floor(21 / 3));
        expect(spacers.every(b => b.materialId === 's')).toBe(true);
    });
});
