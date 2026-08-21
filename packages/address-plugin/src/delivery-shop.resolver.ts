import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    EntityNotFoundError,
    ID,
    Order,
    OrderService,
    Permission,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { DeliveryRange } from './delivery-range.entity';
import { DeliveryService } from './delivery.service';

@Resolver('DeliveryRange')
export class DeliveryShopResolver {
    constructor(
        private deliveryService: DeliveryService,
        private orderService: OrderService,
        private connection: TransactionalConnection,
    ) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myDeliveryAddresses(@Ctx() ctx: RequestContext): Promise<any[]> {
        return this.deliveryService.listMyAddresses(ctx);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createDeliveryAddress(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.deliveryService.createAddress(ctx, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateDeliveryAddress(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ): Promise<any> {
        return this.deliveryService.updateAddress(ctx, id, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async deleteDeliveryAddress(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.deliveryService.deleteAddress(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async setDefaultDeliveryAddress(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<any[]> {
        return this.deliveryService.setDefaultAddress(ctx, id);
    }

    @Query()
    @Allow(Permission.Public)
    async shopDeliveryRange(@Ctx() ctx: RequestContext, @Args('shopId') shopId: ID): Promise<any> {
        return this.deliveryService.getRange(ctx, shopId);
    }

    @Query()
    @Allow(Permission.Public)
    async validateDelivery(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any[]> {
        return this.deliveryService.validateDelivery(ctx, input.address, input.shopIds);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async activeOrderDeliveryStatus(@Ctx() ctx: RequestContext): Promise<any | null> {
        const activeOrderId = ctx.session?.activeOrderId;
        if (!activeOrderId) {
            return null;
        }
        const order = await this.orderService.findOne(ctx, activeOrderId);
        if (!order) {
            return null;
        }
        // 未设置收件区码/经纬度 → 无可预检结果
        if (!this.deliveryService.hasOrderShippingCodes(order)) {
            return null;
        }
        const results = await this.deliveryService.evaluateOrderDelivery(ctx, order as any);
        const deliverable = results.every((r: any) => (r as any).inRange);
        return { deliverable, results };
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async setOrderShippingFromAddress(
        @Ctx() ctx: RequestContext,
        @Args('deliveryAddressId') deliveryAddressId: ID,
    ): Promise<any> {
        const addr = await this.deliveryService.getAddress(ctx, deliveryAddressId);
        const activeOrderId = ctx.session?.activeOrderId;
        if (activeOrderId) {
            const order = await this.orderService.findOne(ctx, activeOrderId);
            if (order) {
                this.deliveryService.applyAddressToOrderShipping(order as any, addr as any);
                await this.connection
                    .getRepository(ctx, Order)
                    .save(order, { reload: false });
            }
        } else {
            throw new EntityNotFoundError('Order', deliveryAddressId);
        }
        return addr;
    }

    @ResolveField('districtCodes')
    districtCodes(@Parent() range: DeliveryRange): string[] | null {
        const raw = (range as any).districtCodes;
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw) as string[];
        } catch {
            return null;
        }
    }
}