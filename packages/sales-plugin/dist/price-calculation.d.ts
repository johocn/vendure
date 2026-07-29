import { Order, OrderItemPriceCalculationStrategy, PriceCalculationResult, ProductVariant, RequestContext } from '@vendure/core';
/**
 * @description
 * 销售开单价格计算策略：当 OrderLine.customFields.overwrittenPrice 非 null 时使用改价，
 * 否则回退到 ProductVariant.listPrice 默认价。
 *
 * 注册到 config.orderOptions.orderItemPriceCalculationStrategy，全局生效但仅当
 * overwrittenPrice 非空时介入，不影响 vshop 客户下单。
 */
export declare class SalesOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    calculateUnitPrice(ctx: RequestContext, productVariant: ProductVariant, orderLineCustomFields: {
        [key: string]: any;
    }, order: Order, quantity: number): PriceCalculationResult | Promise<PriceCalculationResult>;
}
