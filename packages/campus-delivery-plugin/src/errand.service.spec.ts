import { describe, expect, it, vi } from 'vitest';
import { ErrandService } from './errand.service';

function makeEnv(opts: { variant?: any; surcharges?: any[] } = {}) {
    const orderSvc = {
        updateCustomFields: vi.fn().mockResolvedValue({ id: 5 }),
        addSurchargeToOrder: vi.fn().mockResolvedValue({ id: 5 }),
        removeSurchargeFromOrder: vi.fn().mockResolvedValue({ id: 5 }),
    };
    const productService = { create: vi.fn().mockResolvedValue({ id: 9 }) };
    const variantService = { create: vi.fn().mockResolvedValue([{ id: 11, sku: 'CAMPUS-ERRAND-BASE' }]) };
    const injector = {
        get: vi.fn((t: any) => (t.name === 'ProductService' ? productService : variantService)),
    };
    const variantRepo = { findOne: vi.fn().mockResolvedValue(opts.variant ?? null) };
    const orderRepo = { findOne: vi.fn().mockResolvedValue({ id: 5, surcharges: opts.surcharges ?? [] }) };
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) =>
            (ent as any).name === 'ProductVariant' ? variantRepo : orderRepo,
        ),
    } as any;
    const svc = new ErrandService(conn, orderSvc as any, injector as any);
    return { svc, orderSvc, injector, productService, variantService, variantRepo, orderRepo };
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
    const input = { kind: 'pickup_express', fromText: '东门取件', toText: '12号楼501', tip: 100, campusZone: 'A区' };

    it('写 errand customFields + 小费 surcharge', async () => {
        const env = makeEnv();
        const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } } as any;
        await env.svc.setErrandInfo(ctx, input);
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

    it('幂等：同单已有小费 surcharge，先清后加只留一条', async () => {
        const env = makeEnv({
            surcharges: [
                { id: 71, description: '跑腿小费' },
                { id: 72, description: '跑腿小费' },
                { id: 73, description: '其他费用' },
            ],
        });
        const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } } as any;
        await env.svc.setErrandInfo(ctx, input);
        // 只清两条「跑腿小费」，不动其他 surcharge
        expect(env.orderSvc.removeSurchargeFromOrder).toHaveBeenCalledTimes(2);
        expect(env.orderSvc.removeSurchargeFromOrder).toHaveBeenCalledWith(ctx, 5, 71);
        expect(env.orderSvc.removeSurchargeFromOrder).toHaveBeenCalledWith(ctx, 5, 72);
        // 再补一条新小费
        expect(env.orderSvc.addSurchargeToOrder).toHaveBeenCalledOnce();
    });

    it('幂等：tip 改 0 时只清不加', async () => {
        const env = makeEnv({ surcharges: [{ id: 71, description: '跑腿小费' }] });
        const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } } as any;
        await env.svc.setErrandInfo(ctx, { ...input, tip: 0 });
        expect(env.orderSvc.removeSurchargeFromOrder).toHaveBeenCalledWith(ctx, 5, 71);
        expect(env.orderSvc.addSurchargeToOrder).not.toHaveBeenCalled();
    });
});
