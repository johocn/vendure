import { describe, expect, it, vi } from 'vitest';
import { ErrandService } from './errand.service';

function makeEnv(opts: { variant?: any; surcharges?: any[]; zone?: any; building?: any; sourceOrder?: any } = {}) {
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
    const orderRepo: any = {
        findOne: vi.fn().mockResolvedValue({ id: 5, surcharges: opts.surcharges ?? [] }),
        // errandFrom 来源单校验（R2 原单禁止再发跑腿代取）
        createQueryBuilder: vi.fn(() => ({
            leftJoin: vi.fn().mockReturnThis(),
            leftJoinAndSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getOne: vi.fn().mockResolvedValue(opts.sourceOrder ?? null),
        })),
    };
    // 分区/楼栋归属校验：默认落在本渠道（zone id=3 / building id=12 归属 zone 3）；显式传 null 表示查无
    const zoneRepo = { findOne: vi.fn().mockResolvedValue(opts.zone === null ? null : (opts.zone ?? { id: 3, name: 'A区', channelId: 1 })) };
    const buildingRepo = { findOne: vi.fn().mockResolvedValue(opts.building === null ? null : (opts.building ?? { id: 12, zoneId: 3, channelId: 1 })) };
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => {
            const name = (ent as any).name;
            if (name === 'ProductVariant') return variantRepo;
            if (name === 'CampusZone') return zoneRepo;
            if (name === 'CampusBuilding') return buildingRepo;
            return orderRepo;
        }),
    } as any;
    const svc = new ErrandService(conn, orderSvc as any, injector as any);
    return { svc, orderSvc, injector, productService, variantService, variantRepo, orderRepo, zoneRepo, buildingRepo };
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

    it('新增小费失败 → 回补刚清掉的旧小费并抛错（不静默丢失）', async () => {
        const env = makeEnv({ surcharges: [{ id: 71, description: '跑腿小费', listPrice: 100 }] });
        env.orderSvc.addSurchargeToOrder.mockRejectedValueOnce(new Error('db down'));
        const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } } as any;
        await expect(env.svc.setErrandInfo(ctx, input)).rejects.toThrow('db down');
        // 第一次新增新值失败 → 回补旧小费：共 2 次，第二次金额取旧值
        expect(env.orderSvc.addSurchargeToOrder).toHaveBeenCalledTimes(2);
        expect(env.orderSvc.addSurchargeToOrder).toHaveBeenLastCalledWith(
            ctx, 5, expect.objectContaining({ description: '跑腿小费', listPrice: 100 }),
        );
    });
});

describe('ErrandService.setErrandInfo 二期字段', () => {
    const baseInput = { kind: 'pickup_express', fromText: '东门取件', toText: '12号楼501', tip: 0 };
    const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } } as any;

    it('note 透传 errandNote；errandFrom 覆盖优先于 fromText（R2 接力单存原单号）', async () => {
        const env = makeEnv();
        await env.svc.setErrandInfo(ctx, { ...baseInput, note: '两个包裹', errandFrom: 'A100' });
        expect(env.orderSvc.updateCustomFields).toHaveBeenCalledWith(
            ctx, 5,
            expect.objectContaining({ errandNote: '两个包裹', errandFrom: 'A100' }),
        );
    });

    it('errandFrom 缺省落 fromText（普通 R5 保持 A 点文字）', async () => {
        const env = makeEnv();
        await env.svc.setErrandInfo(ctx, baseInput);
        expect(env.orderSvc.updateCustomFields).toHaveBeenCalledWith(
            ctx, 5, expect.objectContaining({ errandFrom: '东门取件' }),
        );
    });

    it('errandFrom 命中本人 R2 原单 → 拒绝（第二段由校园骑手自动接力，避免双配送/双计费）', async () => {
        const env = makeEnv({
            sourceOrder: { id: 7, customFields: { fulfillmentRoute: 'R2' }, customer: { user: { id: 9 } } },
        });
        await expect(env.svc.setErrandInfo(ctx, { ...baseInput, errandFrom: 'A100' }))
            .rejects.toThrow('该订单由平台配送到校，无需再发跑腿代取');
        expect(env.orderSvc.updateCustomFields).not.toHaveBeenCalled();
    });

    it('errandFrom 命中他人订单 → ForbiddenError', async () => {
        const env = makeEnv({
            sourceOrder: { id: 7, customFields: { fulfillmentRoute: 'R2' }, customer: { user: { id: 8 } } },
        });
        await expect(env.svc.setErrandInfo(ctx, { ...baseInput, errandFrom: 'A100' })).rejects.toThrow();
        expect(env.orderSvc.updateCustomFields).not.toHaveBeenCalled();
    });
});

describe('ErrandService.setErrandInfo 入参校验（P2）', () => {
    const ctx = { channelId: 1, activeUserId: 9, session: { activeOrderId: 5 } } as any;
    const base = { kind: 'pickup_express', fromText: '东门取件', toText: '12号楼501', tip: 0 };

    it('kind 不在白名单 → 拒绝', async () => {
        const env = makeEnv();
        await expect(env.svc.setErrandInfo(ctx, { ...base, kind: 'hack' })).rejects.toThrow('跑腿类型不合法');
        expect(env.orderSvc.updateCustomFields).not.toHaveBeenCalled();
    });

    it('起点/终点为空 → 拒绝', async () => {
        const env = makeEnv();
        await expect(env.svc.setErrandInfo(ctx, { ...base, fromText: '  ' })).rejects.toThrow('请填写跑腿起点和终点');
        expect(env.orderSvc.updateCustomFields).not.toHaveBeenCalled();
    });

    it('起点超 100 字符 / 备注超 200 字符 → 拒绝', async () => {
        const env = makeEnv();
        await expect(env.svc.setErrandInfo(ctx, { ...base, toText: 'x'.repeat(101) }))
            .rejects.toThrow('起点/终点不能超过 100 个字符');
        await expect(env.svc.setErrandInfo(ctx, { ...base, note: 'x'.repeat(201) }))
            .rejects.toThrow('备注不能超过 200 个字符');
        expect(env.orderSvc.updateCustomFields).not.toHaveBeenCalled();
    });

    it('分区不属于当前店铺 → 拒绝', async () => {
        const env = makeEnv({ zone: null });
        await expect(env.svc.setErrandInfo(ctx, { ...base, campusZone: 'B区' })).rejects.toThrow('跑腿分区不属于当前店铺');
        expect(env.orderSvc.updateCustomFields).not.toHaveBeenCalled();
    });

    it('楼栋不属于当前店铺 → 拒绝', async () => {
        const env = makeEnv({ building: null });
        await expect(env.svc.setErrandInfo(ctx, { ...base, buildingId: '12' })).rejects.toThrow('楼栋不属于当前店铺');
        expect(env.orderSvc.updateCustomFields).not.toHaveBeenCalled();
    });

    it('楼栋与所选分区不一致 → 拒绝', async () => {
        const env = makeEnv({ building: { id: 12, zoneId: 99, channelId: 1 } });
        await expect(env.svc.setErrandInfo(ctx, { ...base, campusZone: 'A区', buildingId: '12' }))
            .rejects.toThrow('楼栋不属于所选分区');
        expect(env.orderSvc.updateCustomFields).not.toHaveBeenCalled();
    });

    it('仅传 buildingId → 按楼栋反查分区名回填', async () => {
        const env = makeEnv({ building: { id: 12, zoneId: 3, channelId: 1 } });
        await env.svc.setErrandInfo(ctx, { ...base, buildingId: '12' });
        expect(env.orderSvc.updateCustomFields).toHaveBeenCalledWith(
            ctx, 5, expect.objectContaining({ buildingId: '12', campusZone: 'A区' }),
        );
    });
});

describe('ErrandService.getErrandBaseFee', () => {
    it('配置存在返回 errandBaseFee，缺失回默认 200 分', async () => {
        const env = makeEnv();
        env.orderRepo.findOne.mockResolvedValue({ errandBaseFee: 300 });
        expect(await env.svc.getErrandBaseFee({ channelId: 2 } as any)).toBe(300);
        env.orderRepo.findOne.mockResolvedValue(null);
        expect(await env.svc.getErrandBaseFee({ channelId: 2 } as any)).toBe(200);
    });
});
