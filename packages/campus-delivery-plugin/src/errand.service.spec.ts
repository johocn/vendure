import { describe, expect, it, vi } from 'vitest';
import { ErrandService } from './errand.service';

function makeEnv(opts: { variant?: any } = {}) {
    const orderSvc = {
        updateCustomFields: vi.fn().mockResolvedValue({ id: 5 }),
        addSurchargeToOrder: vi.fn().mockResolvedValue({ id: 5 }),
    };
    const productService = { create: vi.fn().mockResolvedValue({ id: 9 }) };
    const variantService = { create: vi.fn().mockResolvedValue([{ id: 11, sku: 'CAMPUS-ERRAND-BASE' }]) };
    const injector = {
        get: vi.fn((t: any) => (t.name === 'ProductService' ? productService : variantService)),
    };
    const variantRepo = { findOne: vi.fn().mockResolvedValue(opts.variant ?? null) };
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => ((ent as any).name === 'ProductVariant' ? variantRepo : {})),
    } as any;
    const svc = new ErrandService(conn, orderSvc as any, injector as any);
    return { svc, orderSvc, injector, productService, variantService, variantRepo };
}

describe('ErrandService.ensureErrandProduct', () => {
    it('SKU 不存在则创建（ProductService + ProductVariantService 组合）', async () => {
        const env = makeEnv({ variant: null });
        const res = await env.svc.ensureErrandProduct({ languageCode: 'zh' } as any);
        expect(env.productService.create).toHaveBeenCalledOnce();
        expect(env.variantService.create).toHaveBeenCalledWith(
            expect.anything(),
            expect.arrayContaining([expect.objectContaining({ sku: 'CAMPUS-ERRAND-BASE', price: 0 })]),
        );
        expect(res).toEqual(expect.objectContaining({ variantId: 11, sku: 'CAMPUS-ERRAND-BASE' }));
    });

    it('SKU 已存在则幂等返回（不再创建）', async () => {
        const env = makeEnv({ variant: { id: 11, sku: 'CAMPUS-ERRAND-BASE' } });
        const res = await env.svc.ensureErrandProduct({ languageCode: 'zh' } as any);
        expect(env.productService.create).not.toHaveBeenCalled();
        expect(env.variantService.create).not.toHaveBeenCalled();
        expect(res).toEqual(expect.objectContaining({ variantId: 11, sku: 'CAMPUS-ERRAND-BASE' }));
    });
});

describe('ErrandService.setErrandInfo', () => {
    it('写 errand customFields + 小费 surcharge', async () => {
        const env = makeEnv();
        const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } } as any;
        await env.svc.setErrandInfo(ctx, {
            kind: 'pickup_express',
            fromText: '东门取件',
            toText: '12号楼501',
            tip: 100,
            campusZone: 'A区',
        });
        expect(env.orderSvc.updateCustomFields).toHaveBeenCalledWith(
            ctx,
            5,
            expect.objectContaining({
                orderKind: 'errand',
                fulfillmentRoute: 'R5',
                errandKind: 'pickup_express',
                tip: 100,
                campusZone: 'A区',
            }),
        );
        expect(env.orderSvc.addSurchargeToOrder).toHaveBeenCalledWith(
            expect.anything(),
            5,
            expect.objectContaining({ listPrice: 100 }),
        );
    });
});
