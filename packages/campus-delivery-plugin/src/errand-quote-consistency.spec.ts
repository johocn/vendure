import { describe, expect, it, vi } from 'vitest';
import { ErrandService } from './errand.service';
import { bindCampusErrandCalculatorConnection, campusErrandCalculator } from './shipping-calculator';

/**
 * P3 跑腿报价一致性：C 端发单页读到的起步价（ErrandService.getErrandBaseFee）
 * 必须与结算时 ShippingCalculator 实际收取的运费同口径（同一份动态加价规则 + 同一封顶）。
 */
function makeEnv(dynamicPricing: Record<string, any> | null) {
    // 实体列 dynamicPricing 为 simple-json，运行时已反序列化为对象（非 JSON 字符串）
    const cfg = { channelId: 1, errandBaseFee: 200, dynamicPricing };
    const cfgRepo = { findOne: vi.fn().mockResolvedValue(cfg) };
    const conn = {
        getRepository: vi.fn(() => cfgRepo),
        rawConnection: { getRepository: vi.fn(() => cfgRepo) },
    } as any;
    bindCampusErrandCalculatorConnection(conn);
    const svc = new ErrandService(conn, {} as any, {} as any);
    return { svc, conn };
}

async function quoteAndCharge(dynamicPricing: Record<string, any> | null) {
    const { svc } = makeEnv(dynamicPricing);
    const ctx = { channelId: 1 } as any;
    const quote = await svc.getErrandBaseFee(ctx);
    const charge = await campusErrandCalculator.calculate!(
        ctx,
        { customFields: { orderKind: 'errand' } } as any,
        [],
        {} as any,
    );
    return { quote, charge: charge as any };
}

describe('跑腿报价一致性（发单页报价 = 结算实收）', () => {
    it('动态计价关闭：两处都取起步价 200 分', async () => {
        const { quote, charge } = await quoteAndCharge(null);
        expect(quote).toBe(200);
        expect(charge.price).toBe(200);
    });

    it('手动倍率 1.5x + 加价封顶 100：两处均为 300 分且拆解一致', async () => {
        const pricing = { enabled: true, manualMultiplier: 1.5, maxAddFee: 100 };
        const { quote, charge } = await quoteAndCharge(pricing);
        expect(quote).toBe(300);
        expect(charge.price).toBe(300);
        expect(charge.metadata.baseFee).toBe(200);
        expect(charge.metadata.addFee).toBe(100);
        expect(charge.metadata.scope).toBe('errand');
    });
});
