import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCampusErrandCalculatorConnection, campusErrandCalculator } from './shipping-calculator';

function makeCtx(channelId: number) { return { channelId } as any; }

describe('campusErrandCalculator', () => {
    const zoneRepo = { find: vi.fn() };
    const cfgRepo = { findOne: vi.fn() };
    beforeEach(() => {
        vi.clearAllMocks();
        bindCampusErrandCalculatorConnection({
            rawConnection: {
                getRepository: vi.fn((ent: any) => {
                    const n = ent.name ?? String(ent);
                    return n === 'CampusZone' ? zoneRepo : cfgRepo;
                }),
            },
        } as any);
    });
    afterEach(() => { bindCampusErrandCalculatorConnection(null as any); });

    it('R5 跑腿单：运费 = errandBaseFee（300 分）', async () => {
        cfgRepo.findOne.mockResolvedValue({ errandBaseFee: 300 });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { customFields: { orderKind: 'errand' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(300);
    });

    it('R5 跑腿单：无配置回默认 200 分', async () => {
        cfgRepo.findOne.mockResolvedValue(null);
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { customFields: { orderKind: 'errand' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(200);
    });

    it('R1 单仍按分区 zone.fee', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 150 }]);
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { customFields: { orderKind: 'normal', fulfillmentRoute: 'R1', campusZone: '东区' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(150);
    });

    it('普通单/R2 返回 undefined（回落店铺普通运费）', async () => {
        for (const cf of [{}, { fulfillmentRoute: 'R2' }]) {
            const res = await campusErrandCalculator.calculate(
                makeCtx(2), { customFields: cf } as any, [] as any, {} as any,
            );
            expect(res).toBeUndefined();
        }
    });

    // ===== plan 3.2 满X免配送费（仅 R1/R3 外卖单） =====
    it('R1 达门槛：运费 0 + metadata 划线原价/门槛', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 200 }]);
        cfgRepo.findOne.mockResolvedValue({ errandBaseFee: null, freeShippingThreshold: 1800 });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { subTotalWithTax: 2045, customFields: { fulfillmentRoute: 'R1', campusZone: '东区' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(0);
        expect(res!.metadata).toMatchObject({ freeShipping: true, originalPrice: 200, threshold: 1800 });
    });

    it('R1 未达门槛：仍收分区运费', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 200 }]);
        cfgRepo.findOne.mockResolvedValue({ freeShippingThreshold: 1800 });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { subTotalWithTax: 1500, customFields: { fulfillmentRoute: 'R3', campusZone: '东区' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(200);
        expect(res!.metadata?.freeShipping).toBeUndefined();
    });

    it('R1 门槛 0/null 视为不启用', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 200 }]);
        for (const cfg of [{ freeShippingThreshold: 0 }, { freeShippingThreshold: null }, {}]) {
            cfgRepo.findOne.mockResolvedValue(cfg);
            const res = await campusErrandCalculator.calculate(
                makeCtx(2),
                { subTotalWithTax: 999999, customFields: { fulfillmentRoute: 'R1', campusZone: '东区' } } as any,
                [] as any, {} as any,
            );
            expect(res!.price).toBe(200);
        }
    });

    it('R5 跑腿单不参与满免（达门槛仍收起步价）', async () => {
        cfgRepo.findOne.mockResolvedValue({ errandBaseFee: 300, freeShippingThreshold: 100 });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { subTotalWithTax: 5000, customFields: { orderKind: 'errand' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(300);
        expect(res!.metadata?.freeShipping).toBeUndefined();
    });

    // ===== P3-4 配送费阶梯计价（按商品金额分档替换基价） =====
    it('阶梯：命中「门槛 <= 商品金额」的最高档替换基价', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 300 }]);
        cfgRepo.findOne.mockResolvedValue({
            deliveryFeeTiers: [{ minAmount: 2000, fee: 200 }, { minAmount: 4000, fee: 100 }],
        });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { subTotalWithTax: 4500, customFields: { fulfillmentRoute: 'R1', campusZone: '东区' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(100);
        expect(res!.metadata).toMatchObject({ zoneFee: 300, baseFee: 100, tier: { minAmount: 4000, fee: 100 } });
    });

    it('阶梯：未达最低档回退分区固定运费', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 300 }]);
        cfgRepo.findOne.mockResolvedValue({ deliveryFeeTiers: [{ minAmount: 2000, fee: 200 }] });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { subTotalWithTax: 1500, customFields: { fulfillmentRoute: 'R3', campusZone: '东区' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(300);
        expect(res!.metadata?.tier).toBeUndefined();
    });

    it('阶梯：满免优先于阶梯（达门槛直接 0）', async () => {
        zoneRepo.find.mockResolvedValue([{ name: '东区', fee: 300 }]);
        cfgRepo.findOne.mockResolvedValue({
            freeShippingThreshold: 3000,
            deliveryFeeTiers: [{ minAmount: 2000, fee: 100 }],
        });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { subTotalWithTax: 3500, customFields: { fulfillmentRoute: 'R1', campusZone: '东区' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(0);
        expect(res!.metadata?.freeShipping).toBe(true);
    });

    // ===== 动态计价覆盖跑腿/第三方（2026-10-23） =====
    const dynamicMul = (multiplier: number) => JSON.stringify({
        enabled: true, peakWindows: [], supply: null, manualMultiplier: multiplier, maxAddFee: 600,
    });

    it('R5 跑腿单：动态倍率作用于起步价（300 ×1.5 → 450）', async () => {
        cfgRepo.findOne.mockResolvedValue({ errandBaseFee: 300, dynamicPricing: JSON.parse(dynamicMul(1.5)) });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { customFields: { orderKind: 'errand' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(450);
        expect(res!.metadata).toMatchObject({ scope: 'errand', baseFee: 300, addFee: 150, pricing: 'dynamic' });
    });

    it('R5 跑腿单：动态倍率受单笔封顶（300 ×2 → 450，封顶 150）', async () => {
        cfgRepo.findOne.mockResolvedValue({
            errandBaseFee: 300,
            dynamicPricing: { enabled: true, peakWindows: [], supply: null, manualMultiplier: 2, maxAddFee: 150 },
        });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { customFields: { orderKind: 'errand' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(450);
        expect(res!.metadata?.addFee).toBe(150);
    });

    it('R2 第三方到校：配置 thirdPartyBaseFee 后接管运费并叠加动态倍率', async () => {
        cfgRepo.findOne.mockResolvedValue({ thirdPartyBaseFee: 500, dynamicPricing: JSON.parse(dynamicMul(1.5)) });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { subTotalWithTax: 999999, customFields: { fulfillmentRoute: 'R2', campusZone: '东区' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(750);
        expect(res!.metadata).toMatchObject({ scope: 'third-party', baseFee: 500, addFee: 250, pricing: 'dynamic' });
        // 满免门槛仅针对 R1/R3：第三方基价不因商品金额达标归零
        expect(res!.metadata?.freeShipping).toBeUndefined();
    });

    it('R2 第三方到校：thirdPartyBaseFee=0 → 平台免费接管（不再回落店铺普通快递运费）', async () => {
        cfgRepo.findOne.mockResolvedValue({ thirdPartyBaseFee: 0 });
        const res = await campusErrandCalculator.calculate(
            makeCtx(2),
            { subTotalWithTax: 999999, customFields: { fulfillmentRoute: 'R2', campusZone: '东区' } } as any,
            [] as any, {} as any,
        );
        expect(res!.price).toBe(0);
        expect(res!.metadata).toMatchObject({ scope: 'third-party', baseFee: 0, pricing: 'base-fee' });
    });

    // ===== 供需加价必须带在线骑手数（与改址/派单同口径，2026-10-24） =====
    it('供需加价：积压达标且在线骑手 <= riderThreshold 才加价，骑手充足不加价', async () => {
        const supply = { backlogThreshold: 5, riderThreshold: 3, addFee: 200 };
        const bind = (riders: number) => {
            const chain = (count: number) => {
                const qb: any = {
                    innerJoin: () => qb, leftJoin: () => qb, where: () => qb, andWhere: () => qb,
                    getCount: async () => count,
                };
                return qb;
            };
            bindCampusErrandCalculatorConnection({
                rawConnection: {
                    getRepository: (ent: any) => {
                        const n = ent.name ?? String(ent);
                        if (n === 'CampusZone') return zoneRepo;
                        if (n === 'Order') return { createQueryBuilder: () => chain(10) };
                        if (n === 'Customer') return { createQueryBuilder: () => chain(riders) };
                        return cfgRepo;
                    },
                },
            } as any);
        };
        cfgRepo.findOne.mockResolvedValue({
            errandBaseFee: 300,
            dynamicPricing: { enabled: true, peakWindows: [], supply, manualMultiplier: 1, maxAddFee: 0 },
        });
        // 渠道号唯一：绕开 backlog/在线骑手 30s 模块级缓存串味
        bind(5);
        const plenty = await campusErrandCalculator.calculate(
            makeCtx(901), { customFields: { orderKind: 'errand' } } as any, [] as any, {} as any,
        );
        expect(plenty!.price).toBe(300);
        bind(2);
        const tight = await campusErrandCalculator.calculate(
            makeCtx(902), { customFields: { orderKind: 'errand' } } as any, [] as any, {} as any,
        );
        expect(tight!.price).toBe(500);
        expect(tight!.metadata).toMatchObject({ addFee: 200 });
    });

});
