import { describe, expect, it } from 'vitest';
import { HotelOrderItemPriceCalculationStrategy } from './hotel-order-item-price-strategy';

const hotelCfg = {
    basePriceCent: 88000,
    priceCalendar: [{ type: 'holiday', priceCent: 100000, dates: ['2026-02-14'] }],
};

function variant(hotelRoomConfig?: string, listPrice = 88000) {
    return { listPrice, listPriceIncludesTax: true, customFields: { hotelRoomConfig } } as any;
}
const ctx = {} as any;
const order = {} as any;

describe('HotelOrderItemPriceCalculationStrategy', () => {
    it('酒店 2 晚 1880 → 均价 940（linePrice 恰为 1880）', async () => {
        const s = new HotelOrderItemPriceCalculationStrategy();
        const r = await s.calculateUnitPrice(
            ctx, variant(JSON.stringify(hotelCfg)),
            { hotelCheckIn: '2026-02-14', hotelCheckOut: '2026-02-16', hotelNights: 2 },
            order, 2,
        );
        expect(r).toEqual({ price: 94000, priceIncludesTax: true });
    });
    it('普通商品直通默认价', async () => {
        const s = new HotelOrderItemPriceCalculationStrategy();
        const r = await s.calculateUnitPrice(ctx, variant(undefined, 9900), {}, order, 1);
        expect(r).toEqual({ price: 9900, priceIncludesTax: true });
    });
    it('酒店变体缺日期 → 回退默认价（不猜测计价）', async () => {
        const s = new HotelOrderItemPriceCalculationStrategy();
        const r = await s.calculateUnitPrice(ctx, variant(JSON.stringify(hotelCfg)), {}, order, 1);
        expect(r).toEqual({ price: 88000, priceIncludesTax: true });
    });
    it('坏 JSON 配置 → 回退默认价', async () => {
        const s = new HotelOrderItemPriceCalculationStrategy();
        const r = await s.calculateUnitPrice(
            ctx, variant('{oops'), { hotelCheckIn: '2026-02-14', hotelCheckOut: '2026-02-16' }, order, 2,
        );
        expect(r).toEqual({ price: 88000, priceIncludesTax: true });
    });

    it('P2：未 init（无服务）时带 ratePlanCode 仍按基价计（策略健壮性）', async () => {
        const s = new HotelOrderItemPriceCalculationStrategy();
        const r = await s.calculateUnitPrice(
            ctx, variant(JSON.stringify(hotelCfg)),
            { hotelCheckIn: '2026-02-14', hotelCheckOut: '2026-02-16', ratePlanCode: 'WKND' },
            order, 2,
        );
        expect(r).toEqual({ price: 94000, priceIncludesTax: true });
    });

    it('P2：init 后按 stub 服务套用方案（discount 千分比）', async () => {
        const s = new HotelOrderItemPriceCalculationStrategy();
        s.init({ get: () => ({
            resolveMemberLevel: async () => null,
            findApplicableByCode: async () => ({ adjustType: 'discount', adjustValue: 800 }),
        }) } as any);
        // 2-14 holiday 100000 ×0.8 = 80000；2-15 weekday 88000 ×0.8 = 70400；合计 150400 → 均价 75200
        const r = await s.calculateUnitPrice(
            ctx, variant(JSON.stringify(hotelCfg)),
            { hotelCheckIn: '2026-02-14', hotelCheckOut: '2026-02-16', ratePlanCode: 'WKND' },
            order, 2,
        );
        expect(r).toEqual({ price: 75200, priceIncludesTax: true });
    });

    it('P2：stub 服务返回 null（坏 code/停用/不可售）→ 回退基价', async () => {
        const s = new HotelOrderItemPriceCalculationStrategy();
        s.init({ get: () => ({
            resolveMemberLevel: async () => null,
            findApplicableByCode: async () => null,
        }) } as any);
        const r = await s.calculateUnitPrice(
            ctx, variant(JSON.stringify(hotelCfg)),
            { hotelCheckIn: '2026-02-14', hotelCheckOut: '2026-02-16', ratePlanCode: 'GONE' },
            order, 2,
        );
        expect(r).toEqual({ price: 94000, priceIncludesTax: true });
    });

    it('P2：方案查询抛异常 → 静默回退基价（不阻断下单）', async () => {
        const s = new HotelOrderItemPriceCalculationStrategy();
        s.init({ get: () => ({
            resolveMemberLevel: async () => { throw new Error('boom'); },
            findApplicableByCode: async () => { throw new Error('boom'); },
        }) } as any);
        const r = await s.calculateUnitPrice(
            ctx, variant(JSON.stringify(hotelCfg)),
            { hotelCheckIn: '2026-02-14', hotelCheckOut: '2026-02-16', ratePlanCode: 'X' },
            order, 2,
        );
        expect(r).toEqual({ price: 94000, priceIncludesTax: true });
    });
});
