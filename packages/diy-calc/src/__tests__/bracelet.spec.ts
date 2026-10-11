import { describe, expect, it } from 'vitest';

import { computeBraceletGeometry, feedbackOf, innerCircOf, MAX_COUNT, MIN_COUNT, pickBestCount } from '../bracelet';

// §7.4 经验校准表（ease=10，gap=0.5）：[手围 W, 直径 d, 轴长 t, N0, 收敛 N, 回算 innerCirc]
const CALIBRATION: Array<[number, number, number, number, number, number]> = [
    [150, 8, 8, 21, 21, 154.0],
    [160, 10, 10, 19, 19, 169.0],
    [170, 12, 12, 17, 17, 176.0],
    [155, 6, 6, 28, 28, 163.5],
    [180, 14, 14, 16, 16, 189.5],
    [145, 4, 4, 37, 36, 149.6],
];

describe('innerCircOf 反向验证（§7.4）', () => {
    it.each(CALIBRATION)('W=%d d=%d → N=%d 时 innerCirc≈%f', (_w, d, _t, _n0, n, inner) => {
        expect(innerCircOf(n, d + 0.5, d)).toBeCloseTo(inner, 1);
    });

    it('8mm×21 颗 → 适合 150mm 手腕（防止公式写反）', () => {
        expect(innerCircOf(21, 8.5, 8)).toBeCloseTo(154.0, 1);
    });
});

describe('feedbackOf 阈值（§7.1 ⑦）', () => {
    it('五级分类边界正确', () => {
        expect(feedbackOf(-1)).toBe('too-tight');
        expect(feedbackOf(0)).toBe('snug');
        expect(feedbackOf(3.9)).toBe('snug');
        expect(feedbackOf(4)).toBe('ok');
        expect(feedbackOf(11.9)).toBe('ok');
        expect(feedbackOf(12)).toBe('loose');
        expect(feedbackOf(24.9)).toBe('loose');
        expect(feedbackOf(25)).toBe('too-loose');
    });
});

describe('pickBestCount 收敛（§7.2）', () => {
    it('N0 已在推荐区间则不动', () => {
        expect(pickBestCount(150, 8, 8.5, 21)).toBe(21);
    });

    it('145/4 行：N0=37 收敛到 36', () => {
        expect(pickBestCount(145, 4, 4.5, 37)).toBe(36);
    });

    it('N0 兜不住手腕时向上加（170 手围配 8mm 珠但 N0 报小）', () => {
        expect(pickBestCount(170, 8, 8.5, 15)).toBe(24);
    });

    it('触及 MIN/MAX 兜底不越界', () => {
        expect(pickBestCount(60, 8, 8.5, MIN_COUNT)).toBeGreaterThanOrEqual(MIN_COUNT);
        expect(pickBestCount(400, 8, 8.5, MAX_COUNT)).toBeLessThanOrEqual(MAX_COUNT);
    });
});

describe('computeBraceletGeometry（§7.1 主算）', () => {
    it.each(CALIBRATION)('W=%d d=%d t=%d → N0=%d N=%d', (w, d, t, n0, n) => {
        const geo = computeBraceletGeometry({ wristSize: w, diameter: d, axialLength: t, gap: 0.5, ease: 10 });
        expect(geo.countInitial).toBe(n0);
        expect(geo.count).toBe(n);
        expect(geo.feedback).toBe('ok');
    });

    it('150/8mm：clearance≈+4.0，adjustHint 给出 ±1 颗建议', () => {
        const geo = computeBraceletGeometry({ wristSize: 150, diameter: 8, axialLength: 8, gap: 0.5, ease: 10 });
        expect(geo.clearance).toBeCloseTo(4.0, 1);
        expect(geo.innerCircumference).toBeCloseTo(154.0, 1);
        expect(geo.centerCircumference).toBeCloseTo(179.17, 1); // π·8.5/sin(π/21)
        expect(geo.adjustHint).toEqual([
            { delta: 1, feedback: 'loose' }, // innerCirc(22)=162.5 → +12.5
            { delta: -1, feedback: 'too-tight' }, // innerCirc(20)=145.6 → −4.4
        ]);
    });

    it('145/4mm：countInitial=37 与 count=36 分开暴露（公式与收敛分别验证）', () => {
        const geo = computeBraceletGeometry({ wristSize: 145, diameter: 4, axialLength: 4, gap: 0.5, ease: 10 });
        expect(geo.countInitial).toBe(37);
        expect(geo.count).toBe(36);
        expect(geo.innerCircumference).toBeCloseTo(149.6, 1);
    });
});
