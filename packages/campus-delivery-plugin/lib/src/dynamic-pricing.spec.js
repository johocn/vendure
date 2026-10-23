"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dynamic_pricing_1 = require("./dynamic-pricing");
const base = 500;
const at = (hhmm) => new Date(`2026-10-23T${hhmm}:00+08:00`);
const cfg = (patch = {}) => (Object.assign(Object.assign(Object.assign({}, dynamic_pricing_1.DEFAULT_DYNAMIC_PRICING), { peakWindows: [] }), patch));
(0, vitest_1.describe)('parseDynamicPricing', () => {
    (0, vitest_1.it)('坏值/缺字段回退默认（关闭）', () => {
        (0, vitest_1.expect)((0, dynamic_pricing_1.parseDynamicPricing)(null).enabled).toBe(false);
        (0, vitest_1.expect)((0, dynamic_pricing_1.parseDynamicPricing)('x').peakWindows).toEqual([]);
        const p = (0, dynamic_pricing_1.parseDynamicPricing)({ enabled: 'yes', manualMultiplier: 9, maxAddFee: -1 });
        (0, vitest_1.expect)(p.enabled).toBe(false);
        (0, vitest_1.expect)(p.manualMultiplier).toBe(1);
        (0, vitest_1.expect)(p.maxAddFee).toBe(dynamic_pricing_1.DEFAULT_DYNAMIC_PRICING.maxAddFee);
    });
    (0, vitest_1.it)('保留合法字段并裁剪倍率到 1.0–2.0', () => {
        const p = (0, dynamic_pricing_1.parseDynamicPricing)({
            enabled: true,
            peakWindows: [{ start: '11:30', end: '13:00', addFee: 200, label: '午高峰' }],
            manualMultiplier: 1.5,
        });
        (0, vitest_1.expect)(p.enabled).toBe(true);
        (0, vitest_1.expect)(p.peakWindows[0].label).toBe('午高峰');
        (0, vitest_1.expect)(p.manualMultiplier).toBe(1.5);
    });
});
(0, vitest_1.describe)('quoteDynamicFee', () => {
    (0, vitest_1.it)('未启用 → 原价、无加价', () => {
        const q = (0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config: cfg(), at: at('12:00'), backlog: 10 });
        (0, vitest_1.expect)(q.price).toBe(base);
        (0, vitest_1.expect)(q.addFee).toBe(0);
        (0, vitest_1.expect)(q.breakdown).toEqual([]);
    });
    (0, vitest_1.it)('时段高峰命中加价，未命中不加', () => {
        const config = cfg({ enabled: true, peakWindows: [{ start: '11:30', end: '13:00', addFee: 200 }] });
        (0, vitest_1.expect)((0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('12:00'), backlog: 0 }).price).toBe(700);
        (0, vitest_1.expect)((0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('13:00'), backlog: 0 }).price).toBe(500);
        (0, vitest_1.expect)((0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('11:29'), backlog: 0 }).price).toBe(500);
    });
    (0, vitest_1.it)('供需：积压达阈值加价，回落阈值内不加', () => {
        const config = cfg({
            enabled: true,
            supply: { backlogThreshold: 5, addFee: 200, releaseBacklog: 2 },
        });
        (0, vitest_1.expect)((0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('12:00'), backlog: 5 }).price).toBe(700);
        (0, vitest_1.expect)((0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('12:00'), backlog: 3 }).price).toBe(500);
        (0, vitest_1.expect)((0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('12:00'), backlog: 6 }).addFee).toBe(200);
    });
    (0, vitest_1.it)('供需：骑手阈值条件不满足时不加价', () => {
        const config = cfg({
            enabled: true,
            supply: { backlogThreshold: 5, riderThreshold: 3, addFee: 200 },
        });
        (0, vitest_1.expect)((0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('12:00'), backlog: 8, onlineRiders: 5 }).addFee).toBe(0);
        (0, vitest_1.expect)((0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('12:00'), backlog: 8, onlineRiders: 2 }).addFee).toBe(200);
    });
    (0, vitest_1.it)('手动倍率作用于基价', () => {
        const config = cfg({ enabled: true, manualMultiplier: 1.5 });
        const q = (0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('12:00'), backlog: 0 });
        (0, vitest_1.expect)(q.addFee).toBe(250);
        (0, vitest_1.expect)(q.price).toBe(750);
    });
    (0, vitest_1.it)('加价封顶（时段+供需+倍率合计超过 maxAddFee 时截断）', () => {
        const config = cfg({
            enabled: true,
            peakWindows: [{ start: '11:30', end: '13:00', addFee: 200 }],
            supply: { backlogThreshold: 5, addFee: 300 },
            manualMultiplier: 1.5,
            maxAddFee: 400,
        });
        const q = (0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: base, config, at: at('12:00'), backlog: 9 });
        (0, vitest_1.expect)(q.addFee).toBe(400);
        (0, vitest_1.expect)(q.price).toBe(900);
    });
    (0, vitest_1.it)('基价为 0（免运费）不参与动态加价', () => {
        const config = cfg({ enabled: true, peakWindows: [{ start: '11:30', end: '13:00', addFee: 200 }] });
        const q = (0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: 0, config, at: at('12:00'), backlog: 9 });
        (0, vitest_1.expect)(q.price).toBe(0);
        (0, vitest_1.expect)(q.addFee).toBe(0);
    });
});
//# sourceMappingURL=dynamic-pricing.spec.js.map