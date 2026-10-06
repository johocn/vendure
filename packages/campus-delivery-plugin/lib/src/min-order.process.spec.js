"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const min_order_process_1 = require("./min-order.process");
function makeData(opts) {
    var _a, _b;
    return {
        ctx: { channelId: 2 },
        order: { subTotal: (_a = opts.subTotal) !== null && _a !== void 0 ? _a : 1000, customFields: (_b = opts.cf) !== null && _b !== void 0 ? _b : {} },
    };
}
(0, vitest_1.describe)('campusMinOrderProcess', () => {
    const cfgRepo = { findOne: vitest_1.vi.fn() };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        (0, min_order_process_1.bindMinOrderConnection)({
            getRepository: vitest_1.vi.fn(() => cfgRepo),
        });
    });
    (0, vitest_1.it)('非 ArrangingPayment 过渡放行', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: 1500 });
        await (0, vitest_1.expect)(min_order_process_1.campusMinOrderProcess.onTransitionStart('AddingItems', 'PaymentAuthorized', makeData({}))).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('未配置 minOrderAmount 放行', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: null });
        await (0, vitest_1.expect)(min_order_process_1.campusMinOrderProcess.onTransitionStart('AddingItems', 'ArrangingPayment', makeData({ subTotal: 0 }))).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('商品单未满起送价抛 UserInputError（文案含元）', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: 1500 });
        await (0, vitest_1.expect)(min_order_process_1.campusMinOrderProcess.onTransitionStart('AddingItems', 'ArrangingPayment', makeData({ subTotal: 1000 }))).rejects.toThrow('未满起送价 ¥15');
    });
    (0, vitest_1.it)('商品单满足起送价放行', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: 1500 });
        await (0, vitest_1.expect)(min_order_process_1.campusMinOrderProcess.onTransitionStart('AddingItems', 'ArrangingPayment', makeData({ subTotal: 2000 }))).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('跑腿单（orderKind=errand）豁免商品起送价', async () => {
        cfgRepo.findOne.mockResolvedValue({ minOrderAmount: 1500 });
        await (0, vitest_1.expect)(min_order_process_1.campusMinOrderProcess.onTransitionStart('AddingItems', 'ArrangingPayment', makeData({ subTotal: 0, cf: { orderKind: 'errand' } }))).resolves.toBeUndefined();
    });
});
//# sourceMappingURL=min-order.process.spec.js.map