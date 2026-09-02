import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Order, Permission, RequestContext, Transaction, UserInputError } from '@vendure/core';
import { OrderService } from '@vendure/core';
import { OrderSplitService } from './order-split.service';

/**
 * 拆单结算入口（统一结算）。内部按所选支付方式聚合拆合并逐单结算：
 * - 选余额 → 全部箱并入 1 单（Path A，一次余额扣款）；
 * - 选非余额且各箱可选方式交集含所选方式 → 并入 1 单（台账另行分账）；
 * - 选非余额且不在交集 → 一律按箱全拆，每配送档案一单。
 * boxKeys/lineIds 可选：限定只结算部分箱 / 箱内部分行；未传则结算全部箱与行，
 * 未选中的行「回流购物车」留在源活动订单。
 * 返回「已各自结算」的订单列表（方法内部逐单 addPaymentToOrder）。
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
        @Args('boxKeys', { type: () => [String] }) boxKeys?: string[],
        @Args('lineIds', { type: () => [String] }) lineIds?: string[],
    ): Promise<Order[]> {
        const order = await this.resolveActiveOrder(ctx);
        const parsedMetadata = metadata ? this.parseMetadata(metadata) : undefined;
        const opts: { boxKeys?: ID[]; lineIds?: ID[] } = {};
        if (boxKeys) opts.boxKeys = boxKeys;
        if (lineIds) opts.lineIds = lineIds;
        return this.orderSplitService.performSplitCheckout(ctx, order, method, parsedMetadata, opts);
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