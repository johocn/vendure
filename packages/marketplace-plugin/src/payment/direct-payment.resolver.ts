import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    CustomerService,
    EntityNotFoundError,
    isGraphQlErrorResult,
    Order,
    OrderService,
    Permission,
    RequestContext,
    Transaction,
} from '@vendure/core';
import { SALE_SOURCE_MARKETPLACE } from '../constants';

@Resolver()
export class DirectPaymentResolver {
    constructor(
        private orderService: OrderService,
        private customerService: CustomerService,
    ) {}

    @Mutation('payMarketplaceSellerOrder')
    @Transaction()
    @Allow(Permission.Owner)
    async payMarketplaceSellerOrder(
        @Ctx() ctx: RequestContext,
        @Args() args: { orderId: string; method: string; metadata?: any },
    ): Promise<any> {
        if (!ctx.activeUserId) {
            return { errorCode: 'NO_ACTIVE_ORDER', message: '未登录' };
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId, false);
        if (!customer) {
            return { errorCode: 'NO_ACTIVE_ORDER', message: '未找到顾客' };
        }

        const order = await this.orderService.findOne(ctx, args.orderId, ['customer', 'channels']);
        if (!order) {
            throw new EntityNotFoundError('Order', args.orderId);
        }
        // 校验订单归属当前顾客
        if (!order.customer || order.customer.id !== customer.id) {
            throw new EntityNotFoundError('Order', args.orderId);
        }
        // 仅允许 marketplace 商家子单通过此入口支付
        if (order.customFields.saleSource !== SALE_SOURCE_MARKETPLACE) {
            return { errorCode: 'ORDER_PAYMENT_STATE', message: '非 marketplace 商家子单，不可在此支付' };
        }

        const result = await this.orderService.addPaymentToOrder(ctx, order.id, {
            method: args.method,
            metadata: args.metadata ?? {},
        });
        if (isGraphQlErrorResult(result)) {
            return result;
        }
        return result;
    }
}