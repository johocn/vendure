import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, Order, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
import { RiderEarning } from './rider-earning.entity';
import { CREDIT_REJECT, RiderCreditService } from './rider-credit.service';
import { RiderService } from './rider.service';

@Resolver()
export class HallShopResolver {
    constructor(
        private grab: HallGrabService,
        private config: CampusConfigService,
        private riderService: RiderService,
        private connection: TransactionalConnection,
        private hall: HallService,
        private credit: RiderCreditService,
    ) {}

    /** grab 失败（已被抢/抢自己的/非骑手）由 service 抛 UserInputError/ForbiddenError，Vendure 转 GraphQL 错误。 */
    @Mutation()
    async campusGrabOrder(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.grab.grab(ctx, orderId);
    }

    /** 拒单：仅限被指派且未取货的骑手；订单回大厅 + 骑手扣分。 */
    @Mutation()
    async campusRejectAssignment(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.rejectAssignment(ctx, orderId);
    }

    private async rejectAssignment(ctx: RequestContext, orderId: ID) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const order = await this.connection.getRepository(ctx, Order).findOne({ where: { id: orderId as any } });
        const cf = order?.customFields as any;
        if (!order || cf.deliveryStaffId !== String(rider.id) || cf.deliveryStatus !== 'assigned') {
            throw new UserInputError('该订单未指派给您或已取货，不能拒单');
        }
        await this.hall.backToHall(ctx, order.id as any);
        await this.credit.adjust(ctx, rider.id as any, CREDIT_REJECT, 'reject_assign', order.id as any);
        return { backToHall: true };
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
        @Args({ name: 'route', type: () => String, nullable: true }) route?: 'R1' | 'R3',
        @Args({ name: 'slotId', type: () => Int, nullable: true }) slotId?: number,
    ) {
        return this.config.setDeliveryTarget(ctx, Number(zoneId), Number(buildingId), route, slotId);
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
