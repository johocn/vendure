import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { HallGrabService } from './hall-grab.service';

@Resolver()
export class HallShopResolver {
    constructor(private grab: HallGrabService) {}

    /** grab 失败（已被抢/抢自己的/非骑手）由 service 抛 UserInputError/ForbiddenError，Vendure 转 GraphQL 错误。 */
    @Mutation()
    async campusGrabOrder(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.grab.grab(ctx, orderId);
    }

    @Query()
    async campusHall(@Ctx() ctx: RequestContext) {
        return this.grab.hall(ctx);
    }
}
