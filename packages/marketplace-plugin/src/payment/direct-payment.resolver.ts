import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
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
    TransactionalConnection,
} from '@vendure/core';
import { SALE_SOURCE_MARKETPLACE } from '../constants';

@Resolver()
export class DirectPaymentResolver {
    constructor(
        private orderService: OrderService,
        private customerService: CustomerService,
        private connection: TransactionalConnection,
    ) {}

    @Mutation('payMarketplaceSellerOrder')
    @Transaction()
    @Allow(Permission.Owner)
    async payMarketplaceSellerOrder(
        @Ctx() ctx: RequestContext,
        @Args() args: { orderId: string; method: string; metadata?: any },
    ): Promise<any> {
        if (!ctx.activeUserId) {
            return { __typename: 'NoActiveOrderError', errorCode: 'NO_ACTIVE_ORDER', message: '未登录' };
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId, false);
        if (!customer) {
            return { __typename: 'NoActiveOrderError', errorCode: 'NO_ACTIVE_ORDER', message: '未找到顾客' };
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
            return {
                __typename: 'OrderPaymentStateError',
                errorCode: 'ORDER_PAYMENT_STATE',
                message: '非 marketplace 商家子单，不可在此支付',
            };
        }

        const result = await this.orderService.addPaymentToOrder(ctx, order.id, {
            method: args.method,
            metadata: args.metadata ?? {},
        });
        if (isGraphQlErrorResult(result)) {
            return { ...result, __typename: 'OrderPaymentStateError' as const, errorCode: (result as any).errorCode };
        }
        return { ...result, __typename: 'Order' as const };
    }

    @Query('myMarketplaceSellerOrders')
    @Allow(Permission.Owner)
    async myMarketplaceSellerOrders(@Ctx() ctx: RequestContext): Promise<any[]> {
        if (!ctx.activeUserId) {
            return [];
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId, false);
        if (!customer) {
            return [];
        }
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.channels', 'channel')
            .leftJoinAndSelect('channel.seller', 'sellerChannel')
            .leftJoinAndSelect('order.lines', 'line')
            .leftJoinAndSelect('line.productVariant', 'productVariant')
            .where('order.customFields.saleSource = :saleSource', {
                saleSource: SALE_SOURCE_MARKETPLACE,
            })
            .andWhere('customer.id = :customerId', { customerId: customer.id })
            .andWhere('order.state != :draftState', { draftState: 'Draft' })
            .orderBy('order.orderPlacedAt', 'DESC');

        const orders = await qb.getMany();
        return orders.map(order => ({
            id: order.id,
            code: order.code,
            state: order.state,
            totalWithTax: order.totalWithTax,
            sellerChannelName: order.channels?.[0]?.seller?.name ?? order.channels?.[0]?.code ?? null,
            lines: (order.lines ?? []).map(line => ({
                id: (line as any).id,
                productName: (line as any).productVariant?.name ?? '',
                quantity: (line as any).quantity,
                unitPriceWithTax: (line as any).unitPriceWithTax,
                linePriceWithTax: (line as any).linePriceWithTax,
            })),
        }));
    }
}