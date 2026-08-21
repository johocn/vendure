import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext, Transaction } from '@vendure/core';
import { LiveRoomService } from './live-room.service';

@Resolver()
export class LiveAdminResolver {
    constructor(private liveRoomService: LiveRoomService) {}

    @Query()
    async liveRooms(@Ctx() ctx: RequestContext, @Args('options') options?: any) {
        return this.liveRoomService.findAll(ctx, options);
    }

    @Query()
    async liveRoom(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.liveRoomService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    async createLiveRoom(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.liveRoomService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    async updateLiveRoom(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.liveRoomService.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    async deleteLiveRoom(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.liveRoomService.delete(ctx, id);
    }

    @Mutation()
    @Transaction()
    async startLiveRoom(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.liveRoomService.start(ctx, id);
    }

    @Mutation()
    @Transaction()
    async stopLiveRoom(@Ctx() ctx: RequestContext, @Args('id') id: ID, @Args('replayUrl') replayUrl?: string) {
        return this.liveRoomService.stop(ctx, id, replayUrl);
    }

    @Mutation()
    @Transaction()
    async addLiveRoomProduct(@Ctx() ctx: RequestContext, @Args('roomId') roomId: ID, @Args('input') input: any) {
        return this.liveRoomService.addProduct(ctx, roomId, input);
    }

    @Mutation()
    @Transaction()
    async removeLiveRoomProduct(@Ctx() ctx: RequestContext, @Args('roomId') roomId: ID, @Args('productId') productId: ID) {
        return this.liveRoomService.removeProduct(ctx, roomId, productId);
    }
}
