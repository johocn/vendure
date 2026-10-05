"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const errand_service_1 = require("./errand.service");
function makeEnv(opts = {}) {
    var _a, _b;
    const orderSvc = {
        updateCustomFields: vitest_1.vi.fn().mockResolvedValue({ id: 5 }),
        addSurchargeToOrder: vitest_1.vi.fn().mockResolvedValue({ id: 5 }),
        removeSurchargeFromOrder: vitest_1.vi.fn().mockResolvedValue({ id: 5 }),
    };
    const productService = { create: vitest_1.vi.fn().mockResolvedValue({ id: 9 }) };
    const variantService = { create: vitest_1.vi.fn().mockResolvedValue([{ id: 11, sku: 'CAMPUS-ERRAND-BASE' }]) };
    const injector = {
        get: vitest_1.vi.fn((t) => (t.name === 'ProductService' ? productService : variantService)),
    };
    const variantRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_a = opts.variant) !== null && _a !== void 0 ? _a : null) };
    const orderRepo = { findOne: vitest_1.vi.fn().mockResolvedValue({ id: 5, surcharges: (_b = opts.surcharges) !== null && _b !== void 0 ? _b : [] }) };
    const conn = {
        getRepository: vitest_1.vi.fn((_ctx, ent) => ent.name === 'ProductVariant' ? variantRepo : orderRepo),
    };
    const svc = new errand_service_1.ErrandService(conn, orderSvc, injector);
    return { svc, orderSvc, injector, productService, variantService, variantRepo, orderRepo };
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
    const input = { kind: 'pickup_express', fromText: '东门取件', toText: '12号楼501', tip: 100, campusZone: 'A区' };
    (0, vitest_1.it)('写 errand customFields + 小费 surcharge', async () => {
        const env = makeEnv();
        const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } };
        await env.svc.setErrandInfo(ctx, input);
        (0, vitest_1.expect)(env.orderSvc.updateCustomFields).toHaveBeenCalledWith(ctx, 5, vitest_1.expect.objectContaining({
            orderKind: 'errand',
            fulfillmentRoute: 'R5',
            errandKind: 'pickup_express',
            tip: 100,
            campusZone: 'A区',
        }));
        (0, vitest_1.expect)(env.orderSvc.addSurchargeToOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), 5, vitest_1.expect.objectContaining({ listPrice: 100 }));
    });
    (0, vitest_1.it)('幂等：同单已有小费 surcharge，先清后加只留一条', async () => {
        const env = makeEnv({
            surcharges: [
                { id: 71, description: '跑腿小费' },
                { id: 72, description: '跑腿小费' },
                { id: 73, description: '其他费用' },
            ],
        });
        const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } };
        await env.svc.setErrandInfo(ctx, input);
        // 只清两条「跑腿小费」，不动其他 surcharge
        (0, vitest_1.expect)(env.orderSvc.removeSurchargeFromOrder).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(env.orderSvc.removeSurchargeFromOrder).toHaveBeenCalledWith(ctx, 5, 71);
        (0, vitest_1.expect)(env.orderSvc.removeSurchargeFromOrder).toHaveBeenCalledWith(ctx, 5, 72);
        // 再补一条新小费
        (0, vitest_1.expect)(env.orderSvc.addSurchargeToOrder).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('幂等：tip 改 0 时只清不加', async () => {
        const env = makeEnv({ surcharges: [{ id: 71, description: '跑腿小费' }] });
        const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } };
        await env.svc.setErrandInfo(ctx, Object.assign(Object.assign({}, input), { tip: 0 }));
        (0, vitest_1.expect)(env.orderSvc.removeSurchargeFromOrder).toHaveBeenCalledWith(ctx, 5, 71);
        (0, vitest_1.expect)(env.orderSvc.addSurchargeToOrder).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=errand.service.spec.js.map