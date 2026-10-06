"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const r4_tag_service_1 = require("./r4-tag.service");
function makeEvent(opts) {
    var _a;
    return {
        ctx: { channelId: 2 },
        order: { id: '9', code: 'TEST01', customFields: { fulfillmentRoute: (_a = opts.route) !== null && _a !== void 0 ? _a : null } },
        toState: opts.toState,
    };
}
function makeSvc(opts) {
    const updateCustomFields = vitest_1.vi.fn().mockResolvedValue({});
    const svc = new r4_tag_service_1.R4TagService({ getRepository: vitest_1.vi.fn(() => ({ findOne: vitest_1.vi.fn().mockResolvedValue({ channelId: 2 }) })) }, {
        hydrate: vitest_1.vi.fn().mockResolvedValue({
            shippingLines: opts.methodCode == null ? [] : [{ shippingMethod: { code: opts.methodCode } }],
        }),
    }, { updateCustomFields });
    return { svc, updateCustomFields };
}
(0, vitest_1.describe)('R4TagService', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('非 ArrangingPayment 过渡不打标', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: 'store-pickup' });
        await svc.tagR4(makeEvent({ toState: 'PaymentAuthorized', methodCode: 'store-pickup' }));
        (0, vitest_1.expect)(updateCustomFields).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('已有路线（R1/R2/R3/R5）不打标', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: 'store-pickup' });
        await svc.tagR4(makeEvent({ toState: 'ArrangingPayment', route: 'R3', methodCode: 'store-pickup' }));
        (0, vitest_1.expect)(updateCustomFields).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('store-pickup 运费方式 → 打标 R4', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: 'store-pickup' });
        await svc.tagR4(makeEvent({ toState: 'ArrangingPayment', methodCode: 'store-pickup' }));
        (0, vitest_1.expect)(updateCustomFields).toHaveBeenCalledWith(vitest_1.expect.anything(), '9', { fulfillmentRoute: 'R4' });
    });
    (0, vitest_1.it)('非 store-pickup 运费方式不打标（R1/R3 等 campus 配送）', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: 'campus-errand-standard' });
        await svc.tagR4(makeEvent({ toState: 'ArrangingPayment', methodCode: 'campus-errand-standard' }));
        (0, vitest_1.expect)(updateCustomFields).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('无配送行不打标', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: null });
        await svc.tagR4(makeEvent({ toState: 'ArrangingPayment', methodCode: null }));
        (0, vitest_1.expect)(updateCustomFields).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=r4-tag.service.spec.js.map