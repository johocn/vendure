"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const errand_service_1 = require("./errand.service");
function makeEnv(opts = {}) {
    var _a;
    const orderSvc = {
        updateCustomFields: vitest_1.vi.fn().mockResolvedValue({ id: 5 }),
        addSurchargeToOrder: vitest_1.vi.fn().mockResolvedValue({ id: 5 }),
    };
    const productService = { create: vitest_1.vi.fn().mockResolvedValue({ id: 9 }) };
    const variantService = { create: vitest_1.vi.fn().mockResolvedValue([{ id: 11, sku: 'CAMPUS-ERRAND-BASE' }]) };
    const injector = {
        get: vitest_1.vi.fn((t) => (t.name === 'ProductService' ? productService : variantService)),
    };
    const variantRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_a = opts.variant) !== null && _a !== void 0 ? _a : null) };
    const conn = {
        getRepository: vitest_1.vi.fn((_ctx, ent) => (ent.name === 'ProductVariant' ? variantRepo : {})),
    };
    const svc = new errand_service_1.ErrandService(conn, orderSvc, injector);
    return { svc, orderSvc, injector, productService, variantService, variantRepo };
}
(0, vitest_1.describe)('ErrandService.ensureErrandProduct', () => {
    (0, vitest_1.it)('SKU 不存在则创建（ProductService + ProductVariantService 组合）', async () => {
        const env = makeEnv({ variant: null });
        const res = await env.svc.ensureErrandProduct({ languageCode: 'zh' });
        (0, vitest_1.expect)(env.productService.create).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(env.variantService.create).toHaveBeenCalledWith(vitest_1.expect.anything(), vitest_1.expect.arrayContaining([vitest_1.expect.objectContaining({ sku: 'CAMPUS-ERRAND-BASE', price: 0 })]));
        (0, vitest_1.expect)(res).toEqual(vitest_1.expect.objectContaining({ variantId: 11, sku: 'CAMPUS-ERRAND-BASE' }));
    });
    (0, vitest_1.it)('SKU 已存在则幂等返回（不再创建）', async () => {
        const env = makeEnv({ variant: { id: 11, sku: 'CAMPUS-ERRAND-BASE' } });
        const res = await env.svc.ensureErrandProduct({ languageCode: 'zh' });
        (0, vitest_1.expect)(env.productService.create).not.toHaveBeenCalled();
        (0, vitest_1.expect)(env.variantService.create).not.toHaveBeenCalled();
        (0, vitest_1.expect)(res).toEqual(vitest_1.expect.objectContaining({ variantId: 11, sku: 'CAMPUS-ERRAND-BASE' }));
    });
});
(0, vitest_1.describe)('ErrandService.setErrandInfo', () => {
    (0, vitest_1.it)('写 errand customFields + 小费 surcharge', async () => {
        const env = makeEnv();
        const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } };
        await env.svc.setErrandInfo(ctx, {
            kind: 'pickup_express',
            fromText: '东门取件',
            toText: '12号楼501',
            tip: 100,
            campusZone: 'A区',
        });
        (0, vitest_1.expect)(env.orderSvc.updateCustomFields).toHaveBeenCalledWith(ctx, 5, vitest_1.expect.objectContaining({
            orderKind: 'errand',
            fulfillmentRoute: 'R5',
            errandKind: 'pickup_express',
            tip: 100,
            campusZone: 'A区',
        }));
        (0, vitest_1.expect)(env.orderSvc.addSurchargeToOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), 5, vitest_1.expect.objectContaining({ listPrice: 100 }));
    });
});
//# sourceMappingURL=errand.service.spec.js.map