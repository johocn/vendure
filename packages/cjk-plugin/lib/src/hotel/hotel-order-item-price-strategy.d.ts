import { Order, OrderItemPriceCalculationStrategy, PriceCalculationResult, ProductVariant, RequestContext } from '@vendure/core';
/**
 * 酒店房型订单行单价策略：
 * - 非酒店变体 / 缺日期 / 坏配置 → 直通默认定价（productVariant.listPrice），普通商品零影响；
 * - 酒店变体 → 按 hotelRoomConfig + 入离日期逐晚计价，单价 = 住宿总价 ÷ 数量，
 *   因 OrderLine.linePrice = unitPrice × quantity，故行小计 ≈ 住宿总价（晚数=数量）。
 */
export declare class HotelOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    calculateUnitPrice(ctx: RequestContext, productVariant: ProductVariant, orderLineCustomFields: {
        [key: string]: any;
    }, order: Order, quantity: number): PriceCalculationResult;
}
