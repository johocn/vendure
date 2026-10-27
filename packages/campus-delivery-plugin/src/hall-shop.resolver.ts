import { Args, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    Order,
    Permission,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { GraphQLID } from 'graphql';
import { CampusConfigService } from './campus-config.service';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
import { RiderEarning } from './rider-earning.entity';
import { CREDIT_REJECT, RiderCreditService } from './rider-credit.service';
import { RiderService } from './rider.service';

@Resolver('Order')
export class OrderDeliveryShopResolver {
    /** 订单配送卡：直接读下单快照，避免在途单被后台配置变更影响 */
    @ResolveField()
    campusOrderDelivery(@Parent() order: Order) {
        const cf = (order.customFields ?? {}) as any;
        if (!cf.deliveryPlan && !cf.thirdPartyProvider && !cf.handoverPointName) return null;
        return {
            deliveryPlan: cf.deliveryPlan ?? null,
            handoverMode: cf.handoverMode ?? null,
            provider: cf.thirdPartyProvider ?? null,
            thirdPartyNo: cf.thirdPartyNo ?? null,
            state: cf.thirdPartyState ?? null,
            courierName: cf.thirdPartyCourierName ?? null,
            courierPhone: cf.thirdPartyCourierPhone ?? null,
            handoverPointName: cf.handoverPointName ?? null,
            handoverPointAddress: cf.handoverPointAddress ?? null,
            handoverAt: cf.handoverAt ?? null,
        };
    }
}

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
    @Allow(Permission.Authenticated)
    async campusGrabOrder(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.grab.grab(ctx, orderId);
    }

    /** 批量接单（P3-3）：勾选多单一次提交。逐单独立事务，失败不影响其余，返回逐单结果。
     * 上限 10：防止一次提交过多导致长事务/锁竞争；超限直接报错（不静默截断）。
     * 注意：同渠道内的订单才可一次提交（ctx 渠道决定班次/配置口径），跨渠道由前端分组。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async campusGrabOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'orderIds', type: () => [GraphQLID] }) orderIds: ID[],
    ) {
        await this.riderService.assertApprovedRider(ctx);
        if (!orderIds?.length) throw new UserInputError('请先选择要接的订单');
        if (orderIds.length > 10) throw new UserInputError('一次最多接 10 单');
        const results: Array<{ orderId: string; ok: boolean; message: string | null }> = [];
        const seen = new Set<string>();
        for (const id of orderIds) {
            const key = String(id);
            if (seen.has(key)) continue;   // 前端重复勾选不重复抢
            seen.add(key);
            try {
                await this.grab.grab(ctx, id);
                results.push({ orderId: key, ok: true, message: null });
            } catch (e: any) {
                results.push({ orderId: key, ok: false, message: e?.message ?? '接单失败' });
            }
        }
        return results;
    }

    /** 拒单：仅限被指派且未取货的骑手；订单回大厅 + 骑手扣分。 */
    @Mutation()
    @Allow(Permission.Authenticated)
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
        // 回厅条件写可能失败（订单已取消/已终态）：失败时不能扣分，也不能假装成功
        const moved = await this.hall.backToHall(ctx, order.id as any);
        if (!moved) throw new UserInputError('订单已取消或已终态，无法拒单');
        await this.credit.adjust(ctx, rider.id as any, CREDIT_REJECT, 'reject_assign', order.id as any);
        return { backToHall: true };
    }

    @Query()
    @Allow(Permission.Authenticated)
    async campusHall(@Ctx() ctx: RequestContext) {
        // F4 收敛信息暴露面：大厅仅对已认证骑手开放（防匿名拉取全渠道单号/金额/楼栋）
        await this.riderService.assertApprovedRider(ctx);
        return this.grab.hall(ctx);
    }

    /** F5 聚合大厅：一次带回全渠道 open 单（骑手端轮询从 N+1 请求降为 1 请求） */
    @Query()
    @Allow(Permission.Authenticated)
    async campusHallAll(@Ctx() ctx: RequestContext) {
        await this.riderService.assertApprovedRider(ctx);
        return this.grab.hallAll(ctx);
    }

    /** 公开只读：选时段前预检余量 */
    @Query()
    @Allow(Permission.Public)
    async campusShopSlots(@Ctx() ctx: RequestContext) {
        return this.config.slotsForShop(ctx);
    }

    /** 写 activeOrder 的配送目标（分区/楼栋/路线/时段）：按 Owner 校验，游客会话同样可用 */
    @Mutation()
    @Allow(Permission.Owner)
    async campusSetDeliveryTarget(
        @Ctx() ctx: RequestContext,
        @Args('zoneId') zoneId: ID,
        @Args('buildingId') buildingId: ID,
        @Args({ name: 'route', type: () => String, nullable: true }) route?: 'R1' | 'R2' | 'R3',
        @Args({ name: 'slotId', type: () => Int, nullable: true }) slotId?: number,
    ) {
        return this.config.setDeliveryTarget(ctx, Number(zoneId), Number(buildingId), route, slotId);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myRiderEarnings(
        @Ctx() ctx: RequestContext,
        @Args('skip', { nullable: true }) skip?: number,
        @Args('take', { nullable: true }) take?: number,
    ) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const safeSkip = Math.max(0, skip ?? 0);
        const safeTake = Math.min(Math.max(take ?? 20, 1), 200);
        return this.connection
            .getRepository(ctx, RiderEarning)
            .createQueryBuilder('earning')
            .where('earning.riderCustomerId = :id', { id: rider.id })
            .orderBy('earning.createdAt', 'DESC')
            .skip(safeSkip)
            .take(safeTake)
            .getMany();
    }
}
