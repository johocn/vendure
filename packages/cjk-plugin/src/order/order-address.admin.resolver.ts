import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    Order,
    Permission,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

/**
 * 改订单收货地址。
 * 注意：Vendure 自带的 setOrderShippingAddress 只在 shop-api 且只作用于活动订单，
 * 后台改已下单订单必须走这里。**不重算运费**（设计 §3 非目标）。
 *
 * Vendure 3.x 的 `Order.shippingAddress` 是 `simple-json` 列（非独立实体），
 * 因此这里做定向 update，避免整单 save 触发额外副作用。
 */
@Resolver()
export class OrderAddressAdminResolver {
    constructor(private connection: TransactionalConnection) {}

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async updateOrderShippingAddress(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('input') input: any,
    ) {
        const repo = this.connection.getRepository(ctx, Order);
        const order = await repo.findOne({ where: { id: Number(orderId) } });
        if (!order) throw new UserInputError(`订单 ${orderId} 不存在`);
        const current = (order.shippingAddress ?? null) as Record<string, any> | null;
        if (!current) throw new UserInputError('该订单没有收货地址，无法修改');

        const next: Record<string, any> = { ...current };
        for (const key of [
            'fullName',
            'phoneNumber',
            'province',
            'city',
            'streetLine1',
            'streetLine2',
            'postalCode',
            'countryCode',
        ]) {
            if (input[key] !== undefined && input[key] !== null) next[key] = input[key];
        }

        // 故意不动 shippingLine / surcharges：仓管只是修正门牌，不应触发运费变更
        await repo.update(order.id, { shippingAddress: next } as any);

        return {
            id: String(order.id),
            code: order.code,
            shippingAddress: next,
        };
    }
}