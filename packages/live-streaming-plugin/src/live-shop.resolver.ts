import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, OrderService, RequestContext, Transaction } from '@vendure/core';
import { LiveRoomService } from './live-room.service';
import { LiveRoomShopService } from './live-room-shop.service';
import { LiveCommissionService } from './live-commission.service';
import { LIVE_PLUGIN_OPTIONS } from './constants';
import { LiveStreamingPluginOptions } from './types';

@Resolver()
export class LiveShopResolver {
    constructor(
        @Inject(LIVE_PLUGIN_OPTIONS) private options: LiveStreamingPluginOptions,
        private liveRoomService: LiveRoomService,
        private liveRoomShopService: LiveRoomShopService,
        private liveCommissionService: LiveCommissionService,
        private orderService: OrderService,
    ) {}

    @Query()
    async liveRooms(@Ctx() ctx: RequestContext, @Args('status') status?: string) {
        return this.liveRoomShopService.list(ctx, status);
    }

    @Query()
    async liveRoom(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.liveRoomShopService.detail(ctx, id);
    }

    @Query()
    async liveRoomProducts(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.liveRoomShopService.listProducts(ctx, id);
    }

    @Mutation()
    @Transaction()
    async enterLiveRoom(@Ctx() ctx: RequestContext, @Args('roomId') roomId: ID) {
        const room = await this.liveRoomService.findOne(ctx, roomId);
        if (!room) throw new Error('Live room not found');
        return this.liveRoomShopService.enterForRoom(
            room,
            ctx.activeUserId,
            this.options.wsUrl,
            this.options.wsSecret,
        );
    }

    @Mutation()
    @Transaction()
    async setOrderLiveRoom(@Ctx() ctx: RequestContext, @Args('roomId') roomId: ID) {
        const order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId!);
        if (!order) throw new Error('No active order');
        await this.liveCommissionService.setOrderLiveRoom(ctx, String(order.id), String(roomId));
        return this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId!);
    }
}
