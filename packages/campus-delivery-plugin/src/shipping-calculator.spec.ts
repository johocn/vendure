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
});
