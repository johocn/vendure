import { describe, expect, it } from 'vitest';
import { DEFAULT_DYNAMIC_PRICING, parseDynamicPricing, quoteDynamicFee } from './dynamic-pricing';

const base = 500;
const at = (hhmm: string) => new Date(`2026-10-23T${hhmm}:00+08:00`);
const cfg = (patch: Partial<typeof DEFAULT_DYNAMIC_PRICING> = {}) => ({
    ...DEFAULT_DYNAMIC_PRICING,
    peakWindows: [],
    ...patch,
});

describe('parseDynamicPricing', () => {
    it('坏值/缺字段回退默认（关闭）', () => {
        expect(parseDynamicPricing(null).enabled).toBe(false);
        expect(parseDynamicPricing('x').peakWindows).toEqual([]);
        const p = parseDynamicPricing({ enabled: 'yes', manualMultiplier: 9, maxAddFee: -1 });
        expect(p.enabled).toBe(false);
        expect(p.manualMultiplier).toBe(1);
        expect(p.maxAddFee).toBe(DEFAULT_DYNAMIC_PRICING.maxAddFee);
    });
    it('保留合法字段并裁剪倍率到 1.0–2.0', () => {
        const p = parseDynamicPricing({
            enabled: true,
            peakWindows: [{ start: '11:30', end: '13:00', addFee: 200, label: '午高峰' }],
            manualMultiplier: 1.5,
        });
        expect(p.enabled).toBe(true);
        expect(p.peakWindows[0].label).toBe('午高峰');
        expect(p.manualMultiplier).toBe(1.5);
    });
});

describe('quoteDynamicFee', () => {
    it('未启用 → 原价、无加价', () => {
        const q = quoteDynamicFee({ baseFee: base, config: cfg(), at: at('12:00'), backlog: 10 });
        expect(q.price).toBe(base);
        expect(q.addFee).toBe(0);
        expect(q.breakdown).toEqual([]);
    });

    it('时段高峰命中加价，未命中不加', () => {
        const config = cfg({ enabled: true, peakWindows: [{ start: '11:30', end: '13:00', addFee: 200 }] });
        expect(quoteDynamicFee({ baseFee: base, config, at: at('12:00'), backlog: 0 }).price).toBe(700);
        expect(quoteDynamicFee({ baseFee: base, config, at: at('13:00'), backlog: 0 }).price).toBe(500);
        expect(quoteDynamicFee({ baseFee: base, config, at: at('11:29'), backlog: 0 }).price).toBe(500);
    });

    it('供需：积压达阈值加价，回落阈值内不加', () => {
        const config = cfg({
            enabled: true,
            supply: { backlogThreshold: 5, addFee: 200, releaseBacklog: 2 },
        });
        expect(quoteDynamicFee({ baseFee: base, config, at: at('12:00'), backlog: 5 }).price).toBe(700);
        expect(quoteDynamicFee({ baseFee: base, config, at: at('12:00'), backlog: 3 }).price).toBe(500);
        expect(quoteDynamicFee({ baseFee: base, config, at: at('12:00'), backlog: 6 }).addFee).toBe(200);
    });

    it('供需：骑手阈值条件不满足时不加价', () => {
        const config = cfg({
            enabled: true,
            supply: { backlogThreshold: 5, riderThreshold: 3, addFee: 200 },
        });
        expect(quoteDynamicFee({ baseFee: base, config, at: at('12:00'), backlog: 8, onlineRiders: 5 }).addFee).toBe(0);
        expect(quoteDynamicFee({ baseFee: base, config, at: at('12:00'), backlog: 8, onlineRiders: 2 }).addFee).toBe(200);
    });

    it('手动倍率作用于基价', () => {
        const config = cfg({ enabled: true, manualMultiplier: 1.5 });
        const q = quoteDynamicFee({ baseFee: base, config, at: at('12:00'), backlog: 0 });
        expect(q.addFee).toBe(250);
        expect(q.price).toBe(750);
    });

    it('加价封顶（时段+供需+倍率合计超过 maxAddFee 时截断）', () => {
        const config = cfg({
            enabled: true,
            peakWindows: [{ start: '11:30', end: '13:00', addFee: 200 }],
            supply: { backlogThreshold: 5, addFee: 300 },
            manualMultiplier: 1.5,
            maxAddFee: 400,
        });
        const q = quoteDynamicFee({ baseFee: base, config, at: at('12:00'), backlog: 9 });
        expect(q.addFee).toBe(400);
        expect(q.price).toBe(900);
    });

    it('基价为 0（免运费）不参与动态加价', () => {
        const config = cfg({ enabled: true, peakWindows: [{ start: '11:30', end: '13:00', addFee: 200 }] });
        const q = quoteDynamicFee({ baseFee: 0, config, at: at('12:00'), backlog: 9 });
        expect(q.price).toBe(0);
        expect(q.addFee).toBe(0);
    });
});
