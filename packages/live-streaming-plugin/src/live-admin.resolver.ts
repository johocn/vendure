import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';
import { LiveRoomService } from './live-room.service';

@Resolver()
export class LiveAdminResolver {
    constructor(private liveRoomService: LiveRoomService) {}

    @Query()
    @Allow(Permission.SuperAdmin)
    async liveRooms(@Ctx() ctx: RequestContext, @Args('options') options?: any) {
        return this.liveRoomService.findAll(ctx, options);
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async liveRoom(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.liveRoomService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin)
    async createLiveRoom(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.liveRoomService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin)
    async updateLiveRoom(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.liveRoomService.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin)
    async deleteLiveRoom(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.liveRoomService.delete(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin)
    async startLiveRoom(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.liveRoomService.start(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin)
    async stopLiveRoom(@Ctx() ctx: RequestContext, @Args('id') id: ID, @Args('replayUrl') replayUrl?: string) {
        return this.liveRoomService.stop(ctx, id, replayUrl);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin)
    async addLiveRoomProduct(@Ctx() ctx: RequestContext, @Args('roomId') roomId: ID, @Args('input') input: any) {
        return this.liveRoomService.addProduct(ctx, roomId, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin)
    async removeLiveRoomProduct(@Ctx() ctx: RequestContext, @Args('roomId') roomId: ID, @Args('productId') productId: ID) {
        return this.liveRoomService.removeProduct(ctx, roomId, productId);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin)
    async setLiveRoomPlatforms(@Ctx() ctx: RequestContext, @Args('roomId') roomId: ID, @Args('platforms') platforms: any) {
        return this.liveRoomService.setPlatforms(ctx, roomId, platforms);
    }
}
