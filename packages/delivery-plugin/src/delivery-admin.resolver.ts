import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    Order,
    Permission,
    RequestContext,
} from '@vendure/core';

import { DeliveryPermissions } from './constants';
import { DeliveryService } from './delivery.service';

/**
 * @description
 * Admin API resolver：送货任务的查询与状态流转。
 *
 * 设计说明：
 * - `myDeliveries` 仅返回 `ctx.activeUserId` 名下的订单；`allDeliveries` 返回全部。
 * - 各 mutation 通过 `@Allow` 限制权限，service 内部再校验 ownership。
 * - 返回类型复用 Vendure 内置 `Order`，customFields 中的 delivery* 字段自动暴露。
 */
@Resolver()
export class DeliveryAdminResolver {
    constructor(private deliveryService: DeliveryService) {}

    @Query()
    @Allow(DeliveryPermissions.ViewAllDeliveries as Permission)
    async allDeliveries(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
    ): Promise<Order[]> {
        return this.deliveryService.findAllDeliveries(ctx, status);
    }

    @Query()
    @Allow(DeliveryPermissions.DeliverOrder as Permission)
    async myDeliveries(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
    ): Promise<Order[]> {
        if (!ctx.activeUserId) {
            return [];
        }
        return this.deliveryService.findMyDeliveries(ctx, String(ctx.activeUserId), status);
    }

    @Mutation()
    @Allow(DeliveryPermissions.DeliverOrder as Permission)
    async startDelivery(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID): Promise<Order> {
        return this.deliveryService.startDelivery(ctx, orderId);
    }

    @Mutation()
    @Allow(DeliveryPermissions.MarkDelivered as Permission)
    async markDelivered(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args({ name: 'photos', type: () => [String] }) photos: string[],
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string,
    ): Promise<Order> {
        return this.deliveryService.markDelivered(ctx, orderId, photos, note);
    }

    @Mutation()
    @Allow(DeliveryPermissions.MarkDelivered as Permission)
    async confirmPickupHandover(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
    ): Promise<Order> {
        return this.deliveryService.confirmPickupHandover(ctx, orderId);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ReportException as Permission)
    async reportException(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args({ name: 'type', type: () => String }) type: string,
        @Args({ name: 'photos', type: () => [String] }) photos: string[],
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string,
    ): Promise<Order> {
        return this.deliveryService.reportException(ctx, orderId, type, photos, note);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ReassignDelivery as Permission)
    async reassignDelivery(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('newStaffId') newStaffId: ID,
    ): Promise<Order> {
        return this.deliveryService.reassignDelivery(ctx, orderId, String(newStaffId));
    }
}
