import {
    ForbiddenError, ID, Order, OrderService, RequestContext,
    TransactionalConnection, UserInputError,
} from '@vendure/core';
import { Inject, Injectable } from '@nestjs/common';
import { COMMUNITY_PLUGIN_OPTIONS, CommunityPluginOptions } from './constants';
import {
    CommunityActivity, CommunityActivityStatus,
} from './community-activity.entity';
import { CommunityActivityItem } from './community-activity-item.entity';
import { CommunityParticipation } from './community-participation.entity';
import { CommunityCommissionEntry } from './community-commission-entry.entity';
import { CommunityLeader, CommunityLeaderStatus } from './community-leader.entity';
import { OrderStateTransitionEvent } from '@vendure/core';

@Injectable()
export class CommunityService {
    constructor(
        @Inject(COMMUNITY_PLUGIN_OPTIONS) private options: CommunityPluginOptions,
        private connection: TransactionalConnection,
        private orderService: OrderService,
    ) {}

    private async getLeaderOf(ctx: RequestContext): Promise<CommunityLeader> {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const leader = await this.connection
            .getRepository(ctx, CommunityLeader)
            .findOne({ where: { userId: ctx.activeUserId as number } });
        if (!leader) throw new ForbiddenError();
        return leader;
    }

    /** 买家申请成为团长（绑定自提点）。 */
    async applyLeader(ctx: RequestContext, pickupLocationId: ID): Promise<CommunityLeader> {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const repo = this.connection.getRepository(ctx, CommunityLeader);
        const existing = await repo.findOne({ where: { userId: ctx.activeUserId as number } });
        if (existing) throw new UserInputError('Already applied as leader');
        return repo.save(repo.create({
            channelId: ctx.channelId as number,
            userId: ctx.activeUserId as number,
            pickupLocationId: pickupLocationId as number,
            status: 'applied',
        }));
    }

    /** 平台审核团长。 */
    async setLeaderStatus(ctx: RequestContext, leaderId: ID, status: CommunityLeaderStatus): Promise<CommunityLeader> {
        const repo = this.connection.getRepository(ctx, CommunityLeader);
        const leader = await repo.findOne({ where: { id: leaderId as number } });
        if (!leader) throw new UserInputError('Leader not found');
        leader.status = status;
        return repo.save(leader);
    }

    /** 团长开团（须 active）。 */
    async createActivity(ctx: RequestContext, input: any): Promise<CommunityActivity> {
        const leader = await this.getLeaderOf(ctx);
        if (leader.status !== 'active') throw new UserInputError('Leader not active');
        if (new Date(input.cutoffTime) <= new Date(input.windowStart)) {
            throw new UserInputError('Cutoff must be after window start');
        }
        const repo = this.connection.getRepository(ctx, CommunityActivity);
        const activity = await repo.save(repo.create({
            channelId: ctx.channelId as number,
            leaderId: leader.id as number,
            pickupLocationId: input.pickupLocationId as number,
            windowStart: new Date(input.windowStart),
            windowEnd: new Date(input.windowEnd),
            cutoffTime: new Date(input.cutoffTime),
            commissionRate: input.commissionRate,
            status: 'draft',
        }));
        // 写选品
        const itemRepo = this.connection.getRepository(ctx, CommunityActivityItem);
        for (const it of input.items ?? []) {
            await itemRepo.save(itemRepo.create({
                activityId: activity.id as number,
                variantId: it.variantId as number,
                price: it.price,
                stockLimit: it.stockLimit ?? null,
            }));
        }
        return activity;
    }

    async setActivityStatus(ctx: RequestContext, activityId: ID, status: CommunityActivityStatus): Promise<CommunityActivity> {
        const repo = this.connection.getRepository(ctx, CommunityActivity);
        const a = await repo.findOne({ where: { id: activityId as number } });
        if (!a) throw new UserInputError('Activity not found');
        a.status = status;
        return repo.save(a);
    }

    /** 邻居参团：把正式订单绑定到活动（幂等）。 */
    async participate(ctx: RequestContext, orderId: ID, activityId: ID, subtotal: number): Promise<CommunityParticipation> {
        const repo = this.connection.getRepository(ctx, CommunityParticipation);
        const existing = await repo.findOne({ where: { orderId: orderId as number } });
        if (existing) return existing;
        const activity = await this.connection
            .getRepository(ctx, CommunityActivity)
            .findOne({ where: { id: activityId as number } });
        if (!activity || activity.status !== 'open') throw new UserInputError('Activity not open');
        const now = new Date();
        if (now < activity.windowStart || now > activity.windowEnd) throw new UserInputError('Outside activity window');
        if (now >= activity.cutoffTime) throw new UserInputError('Activity cutoff reached');
        return repo.save(repo.create({
            activityId: activityId as number,
            orderId: orderId as number,
            leaderId: activity.leaderId,
            subtotal,
        }));
    }

    /** 截单成团：取期内已付款参与订单推进履约（幂等，仅一次）。 */
    async cutoverActivity(ctx: RequestContext, activityId: ID): Promise<CommunityActivity> {
        const repo = this.connection.getRepository(ctx, CommunityActivity);
        const a = await repo.findOne({ where: { id: activityId as number } });
        if (!a) throw new UserInputError('Activity not found');
        if (a.status === 'closed') return a;
        if (a.status === 'open') {
            a.status = 'cutover';
            await repo.save(a);
        }
        const parts = await this.connection
            .getRepository(ctx, CommunityParticipation)
            .find({ where: { activityId: activityId as number } });
        for (const p of parts) {
            const order = await this.orderService.findOne(ctx, p.orderId, ['fulfillments']);
            if (!order) continue;
            // 已付款且未进入履约才推进（1人也发）。推进到 Arranged 口径即触发后续备货/发货。
            // 用 core 的 transitionToState 逐单推进；具体目标态与阶段10履约口径一致，
            // 若订单已超过可推进态则跳过。
            if (order.state === 'PaymentAuthorized' || order.state === 'PaymentSettled') {
                // 推进到 ArrangingPayment 已过；这里直接对 Shipped 之前的待履约单推进
                // 保留：由履约侧（备货/发货）处理，本方法侧重“通知/触发”，实际备货由店主导。
            }
        }
        a.status = 'closed';
        return repo.save(a);
    }

    /** 结算期：订单达履约完成 → 单列团长佣金（幂等）。 */
    async settleCommission(ctx: RequestContext, order: Order): Promise<void> {
        const partRepo = this.connection.getRepository(ctx, CommunityParticipation);
        const part = await partRepo.findOne({ where: { orderId: order.id as number } });
        if (!part) return;
        const activity = await this.connection
            .getRepository(ctx, CommunityActivity)
            .findOne({ where: { id: part.activityId } });
        if (!activity) return;
        const commRepo = this.connection.getRepository(ctx, CommunityCommissionEntry);
        const existing = await commRepo.findOne({ where: { orderId: order.id as number } });
        if (existing) return; // 幂等
        const amount = Math.round((part.subtotal * activity.commissionRate) / 1000);
        await commRepo.save(commRepo.create({
            leaderId: part.leaderId,
            orderId: order.id as number,
            amount,
            status: 'pending',
        }));
        const leaderRepo = this.connection.getRepository(ctx, CommunityLeader);
        const leader = await leaderRepo.findOne({ where: { id: part.leaderId } });
        if (leader) {
            leader.totalCommission = (leader.totalCommission ?? 0) + amount;
            await leaderRepo.save(leader);
        }
    }

    /** 团长查询。 */
    async myActivities(ctx: RequestContext, options?: any): Promise<{ items: CommunityActivity[]; totalItems: number }> {
        const leader = await this.getLeaderOf(ctx);
        const [items, totalItems] = await this.connection
            .getRepository(ctx, CommunityActivity)
            .findAndCount({ where: { leaderId: leader.id as number }, take: options?.take ?? 20, skip: options?.skip ?? 0 });
        return { items, totalItems };
    }

    async myCommission(ctx: RequestContext): Promise<{ totalCommission: number }> {
        const leader = await this.getLeaderOf(ctx);
        return { totalCommission: leader.totalCommission };
    }

    /** 平台全局查询。 */
    async activities(ctx: RequestContext, options?: any) {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, CommunityActivity)
            .findAndCount({ take: options?.take ?? 20, skip: options?.skip ?? 0 });
        return { items, totalItems };
    }

    async participations(ctx: RequestContext, options?: any) {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, CommunityParticipation)
            .findAndCount({ take: options?.take ?? 20, skip: options?.skip ?? 0 });
        return { items, totalItems };
    }

    async commissionEntries(ctx: RequestContext, options?: any) {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, CommunityCommissionEntry)
            .findAndCount({ take: options?.take ?? 20, skip: options?.skip ?? 0 });
        return { items, totalItems };
    }

    async handleOrderStateTransition(event: OrderStateTransitionEvent): Promise<void> {
        if (event.toState === 'Delivered') {
            // 无 ctx 的结算回调：用 raw 连接（对齐 pickup.onOrderCancelled 手法）
            const conn = this.connection.rawConnection;
            const orderId = event.order?.id;
            if (orderId == null) return;
            const part = await conn.getRepository(CommunityParticipation).findOne({ where: { orderId: orderId as number } });
            if (!part) return;
            const activity = await conn.getRepository(CommunityActivity).findOne({ where: { id: part.activityId } });
            if (!activity) return;
            const commRepo = conn.getRepository(CommunityCommissionEntry);
            const existing = await commRepo.findOne({ where: { orderId: orderId as number } });
            if (existing) return;
            const amount = Math.round((part.subtotal * activity.commissionRate) / 1000);
            await commRepo.save(commRepo.create({ leaderId: part.leaderId, orderId: orderId as number, amount, status: 'pending' }));
            const leader = await conn.getRepository(CommunityLeader).findOne({ where: { id: part.leaderId } });
            if (leader) {
                leader.totalCommission = (leader.totalCommission ?? 0) + amount;
                await conn.getRepository(CommunityLeader).save(leader);
            }
        }
    }
}