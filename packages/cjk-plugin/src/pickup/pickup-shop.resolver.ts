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

        // 1. 写入 Order.customFields：选中的自提点、类型 + 坐标快照（就近分配锚点用）
        //    deliveryType='pickup' 是就近锚点（NearestStockLocationStrategy）与核销（confirmPickupHandover）的前置条件，
        //    必须在选点时落库，不能依赖前端回传（否则默认值 'delivery' 会让 pickup 闭环失效）。
        await this.orderService.updateCustomFields(ctx, order.id, {
            deliveryType: 'pickup',
            // relation 自定义字段的 GraphQL 输入键为 <name>Id，updateRelations 按此键读取
            selectedPickupLocationIdId: pickupLocationId,
            pickupType,
            pickupLat: location.coordinates?.lat ?? null,
            pickupLng: location.coordinates?.lng ?? null,
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
