import {
    Order,
    OrderItemPriceCalculationStrategy,
    PriceCalculationResult,
    ProductVariant,
    RequestContext,
    roundMoney,
} from '@vendure/core';
import { calcNightlyPricing, parseHotelRoomConfig } from './hotel-nightly-pricing';

/**
 * 酒店房型订单行单价策略：
 * - 非酒店变体 / 缺日期 / 坏配置 → 直通默认定价（productVariant.listPrice），普通商品零影响；
 * - 酒店变体 → 按 hotelRoomConfig + 入离日期逐晚计价，单价 = 住宿总价 ÷ 数量，
 *   因 OrderLine.linePrice = unitPrice × quantity，故行小计 ≈ 住宿总价（晚数=数量）。
 */
export class HotelOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    calculateUnitPrice(
        ctx: RequestContext,
        productVariant: ProductVariant,
        orderLineCustomFields: { [key: string]: any },
        order: Order,
        quantity: number,
    ): PriceCalculationResult {
        const fallback: PriceCalculationResult = {
            price: productVariant.listPrice,
            priceIncludesTax: productVariant.listPriceIncludesTax,
        };
        const cfg = parseHotelRoomConfig((productVariant as any).customFields?.hotelRoomConfig);
        if (!cfg) return fallback;

        const checkIn = orderLineCustomFields?.hotelCheckIn;
        const checkOut = orderLineCustomFields?.hotelCheckOut;
        if (typeof checkIn !== 'string' || typeof checkOut !== 'string') return fallback;

        const pricing = calcNightlyPricing(cfg, checkIn, checkOut);
        if (!pricing) return fallback;

        const denom = Number.isFinite(quantity) && quantity > 0 ? quantity : pricing.nights.length;
        return {
            price: roundMoney(pricing.stayTotalCent / denom),
            priceIncludesTax: productVariant.listPriceIncludesTax,
        };
    }
}
