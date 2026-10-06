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
});
//# sourceMappingURL=shipping-calculator.spec.js.map