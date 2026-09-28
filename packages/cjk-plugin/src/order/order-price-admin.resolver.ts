import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Order, OrderService, Permission, RequestContext, Transaction, UserInputError } from '@vendure/core';

/** 允许改价的订单状态：草稿单（Modifying）与尚未结算的活动订单 */
const ADJUSTABLE_STATES = ['Modifying', 'AddingItems', 'ArrangingPayment'];

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
@Resolver()
export class OrderPriceAdminResolver {
    constructor(private orderService: OrderService) {}

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async adjustOrderPrice(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { orderId: ID; amount: number; note?: string | null } },
    ): Promise<Order> {
        const { orderId, amount, note } = args.input;
        // 差额单位：分；必须为非零整数（正数加价，负数降价）
        if (!Number.isInteger(amount) || amount === 0) {
            throw new UserInputError('改价差额必须为非零整数（单位：分）');
        }
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new UserInputError(`订单 ${orderId} 不存在`);
        }
        if (!ADJUSTABLE_STATES.includes(order.state)) {
            throw new UserInputError(`订单当前状态「${order.state}」不支持改价`);
        }

        // 渠道级上限：总额比例与绝对额取小
        const cf = (ctx.channel as any)?.customFields ?? {};
        const rateBp = Number.isFinite(cf.orderAdjustMaxRateBp) ? Number(cf.orderAdjustMaxRateBp) : 2000;
        const maxAmount = Number.isFinite(cf.orderAdjustMaxAmount) ? Number(cf.orderAdjustMaxAmount) : 500000;
        const limit = Math.min(Math.floor((order.totalWithTax * rateBp) / 10000), maxAmount);
        if (Math.abs(amount) > limit) {
            throw new UserInputError(`改价幅度超出上限（最多 ${(limit / 100).toFixed(2)} 元）`);
        }
        if (order.totalWithTax + amount < 0) {
            throw new UserInputError('改价后订单总额不能为负数');
        }

        return this.orderService.addSurchargeToOrder(ctx, orderId, {
            description: (note || '后台改价').slice(0, 255),
            sku: '',
            listPrice: amount,
            listPriceIncludesTax: ctx.channel.pricesIncludeTax,
            taxLines: [],
        });
    }
}
