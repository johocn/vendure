import { Injector, Order, OrderLine, RequestContext, ShippingLine, ShippingLineAssignmentStrategy } from '@vendure/core';
/**
 * 按「配送档案分箱」分配 OrderLine → ShippingLine 的自定义策略。
 *
 * 当一个订单被设置多个配送方式（对应多个箱）时，核心的 setShippingMethod 会为每个
 * 配送方式创建一个 ShippingLine，并通过本策略决定每个 ShippingLine 挂哪些 OrderLine。
 * 本策略按变体所属的「已生效配送档案」分箱，把每个箱的 lines 归属到该箱配送方式对应的
 * ShippingLine，从而实现「单订单内多 shippingLine / 多 fulfillment」。
 *
 * 单箱场景退化为默认行为（该箱全部 lines 挂到唯一 ShippingLine）。
 */
export declare class BoxShippingLineAssignmentStrategy implements ShippingLineAssignmentStrategy {
    init(injector: Injector): void;
    assignShippingLineToOrderLines(ctx: RequestContext, shippingLine: ShippingLine, order: Order): Promise<OrderLine[]>;
}
