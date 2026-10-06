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
});
