import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow, ConfigService, Ctx, ID, Order, OrderService, Permission, RequestContext,
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
        const pickupLocation = await this.resolvePickupLocation(ctx, order);
        return buildGuestOverview(order, redemption, pickupLocation);
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
        const pickupLocation = await this.resolvePickupLocation(ctx, refreshed);
        return buildGuestOverview(refreshed, redemption, pickupLocation);
    }

    /**
     * relation 类型自定义字段在 service 层未加载时只回传标量 id；
     * 从订单自定义字段配置取到 PickupLocation 实体类，按 id 解析为脱敏取货点信息。
     */
    private async resolvePickupLocation(
        ctx: RequestContext,
        order: Order,
    ): Promise<{ name: string; address: string; businessHours: string } | null> {
        const raw = ((order.customFields ?? {}) as any).selectedPickupLocationId as any;
        if (raw == null) return null;
        if (typeof raw === 'object' && raw.name != null) {
            return {
                name: String(raw.name ?? ''),
                address: String(raw.address ?? ''),
                businessHours: String(raw.businessHours ?? ''),
            };
        }
        const field = Array.isArray((this.configService.customFields as any)?.Order)
            ? (this.configService.customFields as any).Order.find(
                  (f: any) => f?.name === 'selectedPickupLocationId',
              )
            : null;
        const entityCls = field?.entity;
        if (!entityCls) return null;
        const id = typeof raw === 'number' ? raw : Number(raw);
        if (!id) return null;
        const loc = await this.connection.getRepository(ctx, entityCls).findOne({ where: { id } as any });
        if (!loc) return null;
        return {
            name: String(loc.name ?? ''),
            address: String(loc.address ?? ''),
            businessHours: String(loc.businessHours ?? ''),
        };
    }

    private async loadOrder(ctx: RequestContext, code: string): Promise<Order | null> {
        const order = await this.orderService.findOneByCode(ctx, code, [
            'customer',
            'customer.user',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'fulfillments',
        ] as any);
        return order ?? null;
    }

    private async findRedemption(ctx: RequestContext, orderId: ID): Promise<PickupRedemption | null> {
        return this.connection
            .getRepository(ctx, PickupRedemption)
            .findOne({ where: { orderId: orderId as number } });
    }
}