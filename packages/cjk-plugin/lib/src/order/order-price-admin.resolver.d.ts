import { ID, Order, OrderService, RequestContext } from '@vendure/core';
/**
 * 后台改价（F-WA-08）。
 *
 * 原前端直接调 core 的 `modifyOrder` 且传 `surcharges: [{ priceDelta }]`：
 * ① `priceDelta` 并非 `SurchargeInput` 字段 → 请求本身就被 GraphQL 校验拒绝；
 * ② 即使改成 `price`，core 的 `modifyOrder` 要求订单处于 `Modifying` 态，且降价时
 *    必须有 `refunds`（草稿单无支付记录可退）→ `RefundPaymentIdMissingError`；
 * ③ 改价幅度无服务端上限。
 *
 * 这里统一走 `OrderService.addSurchargeToOrder`（对订单状态无限制，支持带符号 surcharge，
 * 负价即降价），并在服务端强校验差额与渠道上限。
 */
export declare class OrderPriceAdminResolver {
    private orderService;
    constructor(orderService: OrderService);
    adjustOrderPrice(ctx: RequestContext, args: {
        input: {
            orderId: ID;
            amount: number;
            note?: string | null;
        };
    }): Promise<Order>;
}
