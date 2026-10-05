import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { HallGrabService } from './hall-grab.service';
import { RiderEarning } from './rider-earning.entity';
import { RiderService } from './rider.service';

@Resolver()
export class HallShopResolver {
    constructor(
        private grab: HallGrabService,
        private config: CampusConfigService,
        private riderService: RiderService,
        private connection: TransactionalConnection,
    ) {}

    /** grab 失败（已被抢/抢自己的/非骑手）由 service 抛 UserInputError/ForbiddenError，Vendure 转 GraphQL 错误。 */
    @Mutation()
    async campusGrabOrder(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.grab.grab(ctx, orderId);
    }

    @Query()
    async campusHall(@Ctx() ctx: RequestContext) {
        return this.grab.hall(ctx);
    }

    /** 公开只读：选时段前预检余量 */
    @Query()
    async campusShopSlots(@Ctx() ctx: RequestContext) {
        return this.config.slotsForShop(ctx);
    }

    @Mutation()
    async campusSetDeliveryTarget(
        @Ctx() ctx: RequestContext,
        @Args('zoneId') zoneId: ID,
        @Args('buildingId') buildingId: ID,
    ) {
        return this.config.setDeliveryTarget(ctx, Number(zoneId), Number(buildingId));
    }

    @Query()
    async myRiderEarnings(
        @Ctx() ctx: RequestContext,
        @Args('skip', { nullable: true }) skip?: number,
        @Args('take', { nullable: true }) take?: number,
    ) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        return this.connection
            .getRepository(ctx, RiderEarning)
            .createQueryBuilder('earning')
            .where('earning.riderCustomerId = :id', { id: rider.id })
            .orderBy('earning.createdAt', 'DESC')
            .skip(skip ?? 0)
            .take(take ?? 20)
            .getMany();
    }
}
