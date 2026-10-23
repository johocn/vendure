"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shipping_calculator_1 = require("./shipping-calculator");
function makeCtx(channelId) { return { channelId }; }
(0, vitest_1.describe)('campusErrandCalculator', () => {
    const zoneRepo = { find: vitest_1.vi.fn() };
    const cfgRepo = { findOne: vitest_1.vi.fn() };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        (0, shipping_calculator_1.bindCampusErrandCalculatorConnection)({
            rawConnection: {
                getRepository: vitest_1.vi.fn((ent) => {
                    var _a;
                    const n = (_a = ent.name) !== null && _a !== void 0 ? _a : String(ent);
                    return n === 'CampusZone' ? zoneRepo : cfgRepo;
                }),
            },
        });
    });
    (0, vitest_1.afterEach)(() => { (0, shipping_calculator_1.bindCampusErrandCalculatorConnection)(null); });
    (0, vitest_1.it)('R5 跑腿单：运费 = errandBaseFee（300 分）', async () => {
        cfgRepo.findOne.mockResolvedValue({ errandBaseFee: 300 });
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { customFields: { orderKind: 'errand' } }, [], {});
        (0, vitest_1.expect)(res.price).toBe(300);
    });
    (0, vitest_1.it)('R5 跑腿单：无配置回默认 200 分', async () => {
        cfgRepo.findOne.mockResolvedValue(null);
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { customFields: { orderKind: 'errand' } }, [], {});
        (0, vitest_1.expect)(res.price).toBe(200);
    });
    (0, vitest_1.it)('R1 单仍按分区 zone.fee', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 150 }]);
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { customFields: { orderKind: 'normal', fulfillmentRoute: 'R1', campusZone: '东区' } }, [], {});
        (0, vitest_1.expect)(res.price).toBe(150);
    });
    (0, vitest_1.it)('普通单/R2 返回 undefined（回落店铺普通运费）', async () => {
        for (const cf of [{}, { fulfillmentRoute: 'R2' }]) {
            const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { customFields: cf }, [], {});
            (0, vitest_1.expect)(res).toBeUndefined();
        }
    });
    // ===== plan 3.2 满X免配送费（仅 R1/R3 外卖单） =====
    (0, vitest_1.it)('R1 达门槛：运费 0 + metadata 划线原价/门槛', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 200 }]);
        cfgRepo.findOne.mockResolvedValue({ errandBaseFee: null, freeShippingThreshold: 1800 });
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { subTotalWithTax: 2045, customFields: { fulfillmentRoute: 'R1', campusZone: '东区' } }, [], {});
        (0, vitest_1.expect)(res.price).toBe(0);
        (0, vitest_1.expect)(res.metadata).toMatchObject({ freeShipping: true, originalPrice: 200, threshold: 1800 });
    });
    (0, vitest_1.it)('R1 未达门槛：仍收分区运费', async () => {
        var _a;
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 200 }]);
        cfgRepo.findOne.mockResolvedValue({ freeShippingThreshold: 1800 });
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { subTotalWithTax: 1500, customFields: { fulfillmentRoute: 'R3', campusZone: '东区' } }, [], {});
        (0, vitest_1.expect)(res.price).toBe(200);
        (0, vitest_1.expect)((_a = res.metadata) === null || _a === void 0 ? void 0 : _a.freeShipping).toBeUndefined();
    });
    (0, vitest_1.it)('R1 门槛 0/null 视为不启用', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 200 }]);
        for (const cfg of [{ freeShippingThreshold: 0 }, { freeShippingThreshold: null }, {}]) {
            cfgRepo.findOne.mockResolvedValue(cfg);
            const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { subTotalWithTax: 999999, customFields: { fulfillmentRoute: 'R1', campusZone: '东区' } }, [], {});
            (0, vitest_1.expect)(res.price).toBe(200);
        }
    });
    (0, vitest_1.it)('R5 跑腿单不参与满免（达门槛仍收起步价）', async () => {
        var _a;
        cfgRepo.findOne.mockResolvedValue({ errandBaseFee: 300, freeShippingThreshold: 100 });
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { subTotalWithTax: 5000, customFields: { orderKind: 'errand' } }, [], {});
        (0, vitest_1.expect)(res.price).toBe(300);
        (0, vitest_1.expect)((_a = res.metadata) === null || _a === void 0 ? void 0 : _a.freeShipping).toBeUndefined();
    });
    // ===== 动态计价覆盖跑腿/第三方（2026-10-23） =====
    const dynamicMul = (multiplier) => JSON.stringify({
        enabled: true, peakWindows: [], supply: null, manualMultiplier: multiplier, maxAddFee: 600,
    });
    (0, vitest_1.it)('R5 跑腿单：动态倍率作用于起步价（300 ×1.5 → 450）', async () => {
        cfgRepo.findOne.mockResolvedValue({ errandBaseFee: 300, dynamicPricing: JSON.parse(dynamicMul(1.5)) });
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { customFields: { orderKind: 'errand' } }, [], {});
        (0, vitest_1.expect)(res.price).toBe(450);
        (0, vitest_1.expect)(res.metadata).toMatchObject({ scope: 'errand', baseFee: 300, addFee: 150, pricing: 'dynamic' });
    });
    (0, vitest_1.it)('R5 跑腿单：动态倍率受单笔封顶（300 ×2 → 450，封顶 150）', async () => {
        var _a;
        cfgRepo.findOne.mockResolvedValue({
            errandBaseFee: 300,
            dynamicPricing: { enabled: true, peakWindows: [], supply: null, manualMultiplier: 2, maxAddFee: 150 },
        });
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { customFields: { orderKind: 'errand' } }, [], {});
        (0, vitest_1.expect)(res.price).toBe(450);
        (0, vitest_1.expect)((_a = res.metadata) === null || _a === void 0 ? void 0 : _a.addFee).toBe(150);
    });
    (0, vitest_1.it)('R2 第三方到校：配置 thirdPartyBaseFee 后接管运费并叠加动态倍率', async () => {
        var _a;
        cfgRepo.findOne.mockResolvedValue({ thirdPartyBaseFee: 500, dynamicPricing: JSON.parse(dynamicMul(1.5)) });
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { subTotalWithTax: 999999, customFields: { fulfillmentRoute: 'R2', campusZone: '东区' } }, [], {});
        (0, vitest_1.expect)(res.price).toBe(750);
        (0, vitest_1.expect)(res.metadata).toMatchObject({ scope: 'third-party', baseFee: 500, addFee: 250, pricing: 'dynamic' });
        // 满免门槛仅针对 R1/R3：第三方基价不因商品金额达标归零
        (0, vitest_1.expect)((_a = res.metadata) === null || _a === void 0 ? void 0 : _a.freeShipping).toBeUndefined();
    });
    (0, vitest_1.it)('R2 第三方到校：未配置 thirdPartyBaseFee 返回 undefined（沿用店铺普通快递运费）', async () => {
        cfgRepo.findOne.mockResolvedValue({ thirdPartyBaseFee: null, dynamicPricing: JSON.parse(dynamicMul(1.5)) });
        const res = await shipping_calculator_1.campusErrandCalculator.calculate(makeCtx(2), { customFields: { fulfillmentRoute: 'R2', campusZone: '东区' } }, [], {});
        (0, vitest_1.expect)(res).toBeUndefined();
    });
});
//# sourceMappingURL=shipping-calculator.spec.js.map