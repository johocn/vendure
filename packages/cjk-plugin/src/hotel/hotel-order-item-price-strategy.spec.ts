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
});
