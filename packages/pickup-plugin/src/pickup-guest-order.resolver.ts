import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow, ConfigService, Ctx, EntityHydrator, ID, Order, OrderService, Permission, RequestContext,
    TransactionalConnection, UserInputError,
} from '@vendure/core';

import { PickupService } from './pickup.service';
import { PickupRedemption } from './pickup-redemption.entity';
import { buildGuestOverview, GuestOrderOverview, guestLookupAllowed, isGuestOrder } from './pickup-guest-order';

const ERR_NOT_FOUND = 'GUEST_ORDER_NOT_FOUND';

@Resolver()
export class PickupGuestOrderResolver {
    constructor(
        private orderService: OrderService,
        private configService: ConfigService,
        private entityHydrator: EntityHydrator,
        private connection: TransactionalConnection,
        private service: PickupService,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async guestOrderLookup(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { orderCode: string; phone?: string },
    ): Promise<GuestOrderOverview> {
        const order = await this.loadOrder(ctx, input.orderCode);
        if (!order) throw new UserInputError(ERR_NOT_FOUND);
        const windowAccess = input.phone
            ? false
            : await this.configService.orderOptions.orderByCodeAccessStrategy.canAccessOrder(ctx, order);
        if (!guestLookupAllowed(order, input, windowAccess).allowed) {
            throw new UserInputError(ERR_NOT_FOUND);
        }
        await this.service.ensurePickupRedemptionForOrder(ctx, order.id).catch(() => undefined);
        const redemption = await this.findRedemption(ctx, order.id);
        return buildGuestOverview(order, redemption);
    }

    @Mutation()
    @Allow(Permission.Public)
    async guestSetOrderCustomFields(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { orderCode: string; phone: string; name?: string },
    ): Promise<GuestOrderOverview> {
        const order = await this.loadOrder(ctx, input.orderCode);
        if (!order) throw new UserInputError(ERR_NOT_FOUND);
        const windowAccess = await this.configService.orderOptions.orderByCodeAccessStrategy.canAccessOrder(ctx, order);
        if (!windowAccess || !isGuestOrder(order)) {
            throw new UserInputError(ERR_NOT_FOUND);
        }
        await this.orderService.updateCustomFields(ctx, order.id, {
            contactPhone: input.phone,
            ...(input.name ? { contactName: input.name } : {}),
        } as any);
        const refreshed = (await this.loadOrder(ctx, input.orderCode))!;
        await this.service.ensurePickupRedemptionForOrder(ctx, refreshed.id).catch(() => undefined);
        const redemption = await this.findRedemption(ctx, refreshed.id);
        return buildGuestOverview(refreshed, redemption);
    }

    private async loadOrder(ctx: RequestContext, code: string): Promise<Order | null> {
        // 先预载 lines 与 productVariant，EntityHydrator 才能沿 lines→productVariant→product 逐层落到 product
        const order = await this.orderService.findOneByCode(
            ctx,
            code,
            ['customer', 'customer.user', 'lines', 'lines.productVariant'] as any,
        );
        if (!order) return null;
        // relation 类型自定义字段与商品嵌套关系在 service 层默认不加载，
        // 用 EntityHydrator 显式灌注，供 buildGuestOverview 取取货点与商品名。
        await this.entityHydrator.hydrate(ctx, order, {
            relations: [
                'lines.productVariant.product',
                'customFields.selectedPickupLocationId',
                'fulfillments',
            ],
        } as any);
        return order;
    }

    private async findRedemption(ctx: RequestContext, orderId: ID): Promise<PickupRedemption | null> {
        return this.connection
            .getRepository(ctx, PickupRedemption)
            .findOne({ where: { orderId: orderId as number } });
    }
}