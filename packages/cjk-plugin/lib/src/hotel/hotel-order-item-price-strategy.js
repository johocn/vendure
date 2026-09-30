"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelOrderItemPriceCalculationStrategy = void 0;
const core_1 = require("@vendure/core");
const hotel_nightly_pricing_1 = require("./hotel-nightly-pricing");
/**
 * 酒店房型订单行单价策略：
 * - 非酒店变体 / 缺日期 / 坏配置 → 直通默认定价（productVariant.listPrice），普通商品零影响；
 * - 酒店变体 → 按 hotelRoomConfig + 入离日期逐晚计价，单价 = 住宿总价 ÷ 数量，
 *   因 OrderLine.linePrice = unitPrice × quantity，故行小计 ≈ 住宿总价（晚数=数量）。
 */
class HotelOrderItemPriceCalculationStrategy {
    calculateUnitPrice(ctx, productVariant, orderLineCustomFields, order, quantity) {
        var _a;
        const fallback = {
            price: productVariant.listPrice,
            priceIncludesTax: productVariant.listPriceIncludesTax,
        };
        const cfg = (0, hotel_nightly_pricing_1.parseHotelRoomConfig)((_a = productVariant.customFields) === null || _a === void 0 ? void 0 : _a.hotelRoomConfig);
        if (!cfg)
            return fallback;
        const checkIn = orderLineCustomFields === null || orderLineCustomFields === void 0 ? void 0 : orderLineCustomFields.hotelCheckIn;
        const checkOut = orderLineCustomFields === null || orderLineCustomFields === void 0 ? void 0 : orderLineCustomFields.hotelCheckOut;
        if (typeof checkIn !== 'string' || typeof checkOut !== 'string')
            return fallback;
        const pricing = (0, hotel_nightly_pricing_1.calcNightlyPricing)(cfg, checkIn, checkOut);
        if (!pricing)
            return fallback;
        const denom = Number.isFinite(quantity) && quantity > 0 ? quantity : pricing.nights.length;
        return {
            price: (0, core_1.roundMoney)(pricing.stayTotalCent / denom),
            priceIncludesTax: productVariant.listPriceIncludesTax,
        };
    }
}
exports.HotelOrderItemPriceCalculationStrategy = HotelOrderItemPriceCalculationStrategy;
//# sourceMappingURL=hotel-order-item-price-strategy.js.map