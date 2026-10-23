"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const errand_service_1 = require("./errand.service");
const shipping_calculator_1 = require("./shipping-calculator");
/**
 * P3 跑腿报价一致性：C 端发单页读到的起步价（ErrandService.getErrandBaseFee）
 * 必须与结算时 ShippingCalculator 实际收取的运费同口径（同一份动态加价规则 + 同一封顶）。
 */
function makeEnv(dynamicPricing) {
    const cfg = { channelId: 1, errandBaseFee: 200, dynamicPricing };
    const cfgRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(cfg) };
    const conn = {
        getRepository: vitest_1.vi.fn(() => cfgRepo),
        rawConnection: { getRepository: vitest_1.vi.fn(() => cfgRepo) },
    };
    (0, shipping_calculator_1.bindCampusErrandCalculatorConnection)(conn);
    const svc = new errand_service_1.ErrandService(conn, {}, {});
    return { svc, conn };
}
async function quoteAndCharge(dynamicPricing) {
    const { svc } = makeEnv(dynamicPricing);
    const ctx = { channelId: 1 };
    const quote = await svc.getErrandBaseFee(ctx);
    const charge = await shipping_calculator_1.campusErrandCalculator.calculate(ctx, { customFields: { orderKind: 'errand' } }, {}, {});
    return { quote, charge: charge };
}
(0, vitest_1.describe)('跑腿报价一致性（发单页报价 = 结算实收）', () => {
    (0, vitest_1.it)('动态计价关闭：两处都取起步价 200 分', async () => {
        const { quote, charge } = await quoteAndCharge(null);
        (0, vitest_1.expect)(quote).toBe(200);
        (0, vitest_1.expect)(charge.price).toBe(200);
    });
    (0, vitest_1.it)('手动倍率 1.5x + 加价封顶 100：两处均为 300 分且拆解一致', async () => {
        const pricing = JSON.stringify({ enabled: true, manualMultiplier: 1.5, maxAddFee: 100 });
        const { quote, charge } = await quoteAndCharge(pricing);
        (0, vitest_1.expect)(quote).toBe(300);
        (0, vitest_1.expect)(charge.price).toBe(300);
        (0, vitest_1.expect)(charge.metadata.baseFee).toBe(200);
        (0, vitest_1.expect)(charge.metadata.addFee).toBe(100);
        (0, vitest_1.expect)(charge.metadata.scope).toBe('errand');
    });
});
//# sourceMappingURL=errand-quote-consistency.spec.js.map