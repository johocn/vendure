// 房价方案管理 Admin API（P2 Task 7）：web-admin「房价方案」卡的读写入口
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    Permission,
    RequestContext,
    Transaction,
} from '@vendure/core';
import { HotelRatePlan } from './rate-plan.entity';
import { HotelRatePlanService } from './rate-plan.service';

@Resolver()
export class HotelRatePlanAdminResolver {
    constructor(private ratePlanService: HotelRatePlanService) {}

    @Query()
    @Allow(Permission.ReadCatalog, Permission.UpdateCatalog)
    async hotelRatePlans(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
    ): Promise<HotelRatePlan[]> {
        return this.ratePlanService.listByVariant(ctx, variantId);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async createHotelRatePlan(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('input') input: any,
    ): Promise<HotelRatePlan> {
        return this.ratePlanService.create(ctx, variantId, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async updateHotelRatePlan(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ): Promise<HotelRatePlan> {
        return this.ratePlanService.update(ctx, id, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async deleteHotelRatePlan(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<boolean> {
        return this.ratePlanService.delete(ctx, id);
    }
}
