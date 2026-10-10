import { Injector, Order, OrderItemPriceCalculationStrategy, PriceCalculationResult, ProductVariant, RequestContext } from '@vendure/core';
/**
 * 酒店房型订单行单价策略：
 * - 非酒店变体 / 缺日期 / 坏配置 → 直通默认定价（productVariant.listPrice），普通商品零影响；
 * - 酒店变体 → 按 hotelRoomConfig + 入离日期逐晚计价，单价 = 住宿总价 ÷ 数量，
 *   因 OrderLine.linePrice = unitPrice × quantity，故行小计 ≈ 住宿总价（晚数=数量）；
 * - P2 房价方案：OrderLine.customFields.ratePlanCode 存在时套用（enabled + 售卖期含入住日 + 会员达标，
 *   与 C 端可见性同口径）——discount/surcharge 叠加连住优惠，fixed 不叠加；坏 code / 不可用 → 回退基价。
 * 本 Vendure fork（3.6）的 calculateUnitPrice 支持 Promise（core 调用处均 await），故方案查询可异步。
 */
export declare class HotelOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    private ratePlanService;
    init(injector: Injector): void;
    calculateUnitPrice(ctx: RequestContext, productVariant: ProductVariant, orderLineCustomFields: {
        [key: string]: any;
    }, order: Order, quantity: number): Promise<PriceCalculationResult>;
    /** 行上 ratePlanCode → 可套用方案（不可用返回 null 回退基价）；非酒店方案/异常一律静默回退 */
    private resolveRatePlan;
}
