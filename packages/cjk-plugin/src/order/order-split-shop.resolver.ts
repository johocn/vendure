import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Order, Permission, RequestContext, Transaction, UserInputError } from '@vendure/core';
import { OrderService } from '@vendure/core';
import { OrderSplitService } from './order-split.service';

/**
 * 拆单结算入口。用户选择非余额支付方式且聚合需拆多单时调用。
 * 返回的是「已各自结算」的订单列表（方法内部逐单 addPaymentToOrder）。
 * path A（余额）或无需拆单时前端仍走既有单订单 addPaymentToOrder，不应调用本 mutation。
 */
@Resolver()
export class OrderSplitShopResolver {
    constructor(
        private orderService: OrderService,
        private orderSplitService: OrderSplitService,
    ) {}

    private async resolveActiveOrder(ctx: RequestContext): Promise<Order> {
        let order: Order | undefined;
        if (ctx.activeUserId) {
            order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
        } else if (ctx.session?.activeOrderId) {
            order = (await this.orderService.findOne(ctx, ctx.session.activeOrderId)) as Order | undefined;
        }
        if (!order) throw new UserInputError('NO_ACTIVE_ORDER');
        return order;
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.Owner)
    async checkoutSplitted(
        @Ctx() ctx: RequestContext,
        @Args('method') method: string,
        @Args('metadata', { nullable: true, type: () => String }) metadata?: string,
    ): Promise<Order[]> {
        const order = await this.resolveActiveOrder(ctx);
        const parsedMetadata = metadata ? this.parseMetadata(metadata) : undefined;
        return this.orderSplitService.performSplitCheckout(ctx, order, method, parsedMetadata);
    }

    private parseMetadata(raw: string): Record<string, any> | undefined {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : undefined;
        } catch {
            return undefined;
        }
    }
}