import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Order, Permission, RequestContext, UserInputError } from '@vendure/core';
import { OrderService } from '@vendure/core';
import { PickupLocationService } from './pickup-location.service';
import { translateError } from './i18n-messages';

@Resolver()
export class PickupShopResolver {
    constructor(
        private orderService: OrderService,
        private pickupLocationService: PickupLocationService,
    ) {}

    @Mutation()
    @Allow(Permission.Owner)
    async setOrderPickupLocation(
        @Ctx() ctx: RequestContext,
        @Args('pickupLocationId') pickupLocationId: ID,
        @Args('pickupType') pickupType: string,
    ): Promise<Order> {
        // 支持匿名用户和登录用户
        // 匿名用户 ctx.activeUserId 为 undefined，需通过 session.activeOrderId 获取订单
        let order: Order | undefined;
        if (ctx.activeUserId) {
            order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
        } else if (ctx.session?.activeOrderId) {
            order = await this.orderService.findOne(ctx, ctx.session.activeOrderId) ?? undefined;
        }
        if (!order) throw new UserInputError(translateError(ctx, 'NO_ACTIVE_ORDER'));

        const location = await this.pickupLocationService.findOne(ctx, pickupLocationId);
        if (!location) throw new UserInputError(translateError(ctx, 'PICKUP_LOCATION_NOT_VISIBLE'));

        // 1. 写入 Order.customFields
        await this.orderService.updateCustomFields(ctx, order.id, {
            selectedPickupLocationId: pickupLocationId,
            pickupType,
        } as any);

        // 2. 同步设置 shipping address 为自提点地址
        await this.orderService.setShippingAddress(ctx, order.id, {
            fullName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}`.trim() : '自提用户',
            streetLine1: location.address,
            phoneNumber: location.phoneNumber || '',
            countryCode: 'CN',
        } as any);

        return this.orderService.findOne(ctx, order.id) as Promise<Order>;
    }
}
