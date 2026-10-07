import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, Order, RequestContext, UserInputError } from '@vendure/core';
import { DataSource } from 'typeorm';

const INVOICE_ELIGIBLE_STATES = ['PaymentAuthorized', 'PaymentSettled', 'Shipped', 'Delivered'];

/**
 * C 端发票轻量闭环（个人中心 spec §3.3/§4）：
 * 对已支付的历史订单写 invoiceApplied/invoiceInfo customFields（Vendure updateOrderCustomFields
 * 只作用于 activeOrder，历史单不可用，故加本 mutation）。幂等：invoiceApplied=true 再调报错。
 * 商家线下人工开票，B 端本期不动。
 */
@Resolver()
export class InvoiceShopResolver {
    constructor(private dataSource: DataSource) {}

    @Mutation()
    async applyOrderInvoice(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: string,
        @Args('invoiceInfo') invoiceInfo: string,
    ): Promise<boolean> {
        if (!ctx.activeUserId) {
            throw new UserInputError('NOT_LOGGED_IN');
        }
        const order = await this.dataSource.getRepository(Order).findOne({
            where: { id: orderId as any },
            relations: ['customer'],
        });
        if (!order || !order.customer) {
            throw new UserInputError('ORDER_NOT_FOUND');
        }
        // Customer 实体无 userId 标量，归属比对必须走 user 关系（eager:true）
        const ownerId = (order.customer as any)?.user?.id;
        if (String(ownerId) !== String(ctx.activeUserId)) {
            throw new UserInputError('ORDER_NOT_FOUND');
        }
        const cf = (order.customFields || {}) as any;
        if (cf.invoiceApplied) {
            throw new UserInputError('INVOICE_ALREADY_APPLIED');
        }
        if (!INVOICE_ELIGIBLE_STATES.includes(order.state)) {
            throw new UserInputError('ORDER_NOT_PAID');
        }
        order.customFields = { ...cf, invoiceApplied: true, invoiceInfo } as any;
        await this.dataSource.getRepository(Order).save(order);
        return true;
    }
}
