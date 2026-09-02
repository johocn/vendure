import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Order, Permission, RequestContext, UserInputError } from '@vendure/core';
import { OrderService } from '@vendure/core';
import { MerchantSplit, OrderBox, OrderBoxService } from './order-box.service';
import { translateError } from '../pickup/i18n-messages';

@Resolver()
export class OrderBoxShopResolver {
    constructor(
        private orderService: OrderService,
        private orderBoxService: OrderBoxService,
    ) {}

    /** 解析当前活动订单（兼容匿名与登录用户，同 PickupShopResolver 模式） */
    private async resolveActiveOrder(ctx: RequestContext): Promise<Order> {
        let order: Order | undefined;
        if (ctx.activeUserId) {
            order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
        } else if (ctx.session?.activeOrderId) {
            order = (await this.orderService.findOne(ctx, ctx.session.activeOrderId)) ?? undefined;
        }
        if (!order) throw new UserInputError(translateError(ctx, 'NO_ACTIVE_ORDER'));
        return order;
    }

    /**
     * 返回当前订单的分箱结果，供前端「按箱展示配送」使用。
     * 每箱含：生效配送档案、落入 lineIds、可用配送方式、可用自提点，
     * 以及（新增）每箱行明细 lines、可用优惠券、配送费/免邮折扣、箱小计、租户名。
     * 通过关系装载补充 shippingLines / customer / productVariant.product（供按箱金额与券范围判定）。
     */
    @Query()
    @Allow(Permission.Owner)
    async orderBoxes(@Ctx() ctx: RequestContext): Promise<OrderBox[]> {
        const order = await this.resolveActiveOrder(ctx);
        const loaded = await this.orderService.findOne(ctx, order.id, [
            'channels',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'shippingLines',
            'customer',
        ] as any);
        return this.orderBoxService.computeOrderBoxes(ctx, (loaded ?? order) as Order);
    }

    /**
     * 返回当前订单按租户（商户）拆分的结算金额（各箱 subtotal 之和）。
     * 新增 Top-level Query，不改动 orderBoxes 现有结构。
     */
    @Query()
    @Allow(Permission.Owner)
    async orderMerchantSplit(@Ctx() ctx: RequestContext): Promise<MerchantSplit[]> {
        const order = await this.resolveActiveOrder(ctx);
        const loaded = await this.orderService.findOne(ctx, order.id, [
            'channels',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'shippingLines',
            'customer',
        ] as any);
        return this.orderBoxService.computeMerchantSplit(ctx, (loaded ?? order) as Order);
    }

    /**
     * 为某一箱设置配送方式（自提类可同时传 pickupLocationId）。
     * 将该箱 lines 关联到对应 ShippingLine；所有箱一起核心结算，前端按箱各调一次。
     */
    @Mutation()
    @Allow(Permission.Owner)
    async setOrderBoxShippingMethod(
        @Ctx() ctx: RequestContext,
        @Args('boxKey') boxKey: string,
        @Args('shippingMethodId') shippingMethodId: ID,
        @Args('pickupLocationId', { nullable: true }) pickupLocationId?: ID,
    ): Promise<Order> {
        const order = await this.resolveActiveOrder(ctx);
        return this.orderBoxService.setBoxShippingMethod(
            ctx,
            order,
            boxKey,
            shippingMethodId,
            pickupLocationId,
        );
    }
}