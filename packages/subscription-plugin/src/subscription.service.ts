import { Inject, Injectable } from '@nestjs/common';
import {
    AdministratorService,
    ForbiddenError,
    ID,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { Shop } from '@vendure/shop-plugin';

import { SUBSCRIPTION_PLUGIN_OPTIONS } from './constants';
import { SubscriptionOccurrence } from './subscription-occurrence.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { Subscription } from './subscription.entity';
import { ListOptions, SubscriptionItem, SubscriptionPluginOptions } from './types';

/**
 * 周期购/订阅复购核心：买断开通（购审 + 展开排期）、每期生成正式订单并抵扣预存款、
 * 每日调度扫到期期次、续订确认、取消、平台/店主/买家查询，以及 requireMyShop 归属隔离。
 */
@Injectable()
export class SubscriptionService {
    constructor(
        @Inject(SUBSCRIPTION_PLUGIN_OPTIONS) private options: SubscriptionPluginOptions,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private administratorService: AdministratorService,
    ) {}

    /** 从 startDate 出发按频次展开 N 个期次日（不含 startDate 当日之前）。 */
    expandSchedule(frequency: any, periods: number, startDate: Date): Date[] {
        const dates: Date[] = [];
        let cursor = new Date(startDate);
        let guard = 0;
        while (dates.length < periods && guard < periods * 400) {
            cursor = this.nextDate(frequency, cursor);
            dates.push(cursor);
            guard++;
        }
        return dates;
    }

    private nextDate(frequency: any, from: Date): Date {
        const d = new Date(from);
        switch (frequency.kind) {
            case 'daily':
                d.setDate(d.getDate() + 1);
                break;
            case 'weekly': {
                const target = frequency.dayOfWeek; // 0=Sun..6=Sat
                const cur = d.getDay();
                let add = (target - cur + 7) % 7;
                if (add === 0) add = 7;
                d.setDate(d.getDate() + add);
                break;
            }
            case 'everyNDays':
                d.setDate(d.getDate() + frequency.interval);
                break;
            default:
                throw new UserInputError('Unsupported frequency');
        }
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * 买断开通：创建 Subscription（active）+ 展开排期生成 1..N 个 pending 期次。
     * 平台统一征收（collectBuyoutCentrally 为 true 时预存款初始化为买断总价）。
     */
    async createSubscription(ctx: RequestContext, customerId: number, planId: ID, startDate: string): Promise<Subscription> {
        if (!ctx.activeUserId) {
            throw new ForbiddenError();
        }
        const plan = await this.connection.getRepository(ctx, SubscriptionPlan).findOne({
            where: { id: Number(planId), channelId: ctx.channelId as number, enabled: true } as any,
        });
        if (!plan) {
            throw new UserInputError('Plan not found or disabled');
        }
        const subRepo = this.connection.getRepository(ctx, Subscription);
        const total = plan.periods * plan.periodPrice;
        const start = new Date(startDate);
        const schedule = this.expandSchedule(plan.frequency, plan.periods, start);
        const sub = new Subscription({
            channelId: ctx.channelId as number,
            code: `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            planId: plan.id as number,
            shopId: plan.shopId,
            customerId,
            scheduleJson: schedule.map((d) => d.toISOString()),
            startDate: schedule[0] ?? start,
            endDate: schedule[schedule.length - 1] ?? start,
            prepaidBalance: this.options.collectBuyoutCentrally === false ? 0 : total,
            purchasedTotal: total,
            status: 'active',
        } as any);
        const saved = await subRepo.save(sub);
        const occRepo = this.connection.getRepository(ctx, SubscriptionOccurrence);
        for (let i = 0; i < schedule.length; i++) {
            await occRepo.save(new SubscriptionOccurrence({
                channelId: ctx.channelId as number,
                subscriptionId: saved.id as number,
                periodNo: i + 1,
                scheduledDate: schedule[i],
                status: 'pending',
            } as any));
        }
        return saved;
    }

    /**
     * 每日调度 / 手动驱动：扫所有到期 pending 期次。
     * 卖家未指定内容 → skipped；已指定 → createFormalOrder + deductPrepaid。
     */
    async processDueOccurrences(ctx: RequestContext, asOf: Date = new Date()): Promise<{ created: number; skipped: number }> {
        const occRepo = this.connection.getRepository(ctx, SubscriptionOccurrence);
        const due = await occRepo.find({
            where: {
                status: 'pending',
                scheduledDate: { lessThanOrEqual: asOf },
            } as any,
            order: { scheduledDate: 'ASC' },
        });
        let created = 0;
        let skipped = 0;
        for (const occ of due) {
            const items = (occ.sellerItemsJson ?? []) as SubscriptionItem[];
            if (items.length === 0) {
                occ.status = 'skipped';
                occ.skipReason = 'seller items not set';
                await occRepo.save(occ);
                skipped++;
                continue;
            }
            const order = await this.createFormalOrder(ctx, occ, items);
            occ.status = 'orderCreated';
            occ.generatedOrderId = order.id as number;
            occ.orderCode = order.code;
            await occRepo.save(occ);
            await this.deductPrepaid(ctx, occ.subscriptionId, occ.periodNo, occ);
            created++;
        }
        return { created, skipped };
    }

    /** 用 OrderService 建正式订单并加入期次清单，随后推进到 PaymentSettled（平台统一采集语义）。 */
    private async createFormalOrder(ctx: RequestContext, occ: SubscriptionOccurrence, items: SubscriptionItem[]): Promise<any> {
        const sub = await this.connection.getRepository(ctx, Subscription).findOne({ where: { id: occ.subscriptionId } as any });
        if (!sub) {
            throw new UserInputError('Subscription not found');
        }
        const order = await this.orderService.create(ctx, sub.customerId);
        for (const it of items) {
            await this.orderService.addItemToOrder(ctx, order.id, it.variantId as any, it.quantity);
        }
        // 推进到 ArrangingPayment → PaymentSettled（内部采集，不接真实支付网关）
        const transitions = ['ArrangingPayment', 'PaymentSettled'];
        for (const t of transitions) {
            try {
                await this.orderService.transitionToState(ctx, order.id, t as any);
            } catch {
                // 某些过渡可能已到位，忽略
            }
        }
        return this.orderService.findOne(ctx, order.id);
    }

    /** 每期按 periodPrice 抵扣预存款；余额不足则回滚期次 pending 并抛错。 */
    private async deductPrepaid(ctx: RequestContext, subscriptionId: number, periodNo: number, occ: SubscriptionOccurrence): Promise<void> {
        const subRepo = this.connection.getRepository(ctx, Subscription);
        const sub = await subRepo.findOne({ where: { id: subscriptionId } as any });
        if (!sub) {
            throw new UserInputError('Subscription not found');
        }
        const planRepo = this.connection.getRepository(ctx, SubscriptionPlan);
        const plan = await planRepo.findOne({ where: { id: sub.planId } as any });
        const periodPrice = plan?.periodPrice ?? 0;
        if (sub.prepaidBalance < periodPrice) {
            // 余额不足：期次维持 pending，不部分抵扣
            occ.status = 'pending';
            await this.connection.getRepository(ctx, SubscriptionOccurrence).save(occ);
            throw new UserInputError('Insufficient prepaid balance');
        }
        sub.prepaidBalance -= periodPrice;
        await subRepo.save(sub);
    }

    /** 店主为本店某期次指定商品清单（归属校验在外层 resolver）。 */
    async setOccurrenceItems(ctx: RequestContext, occId: ID, items: SubscriptionItem[]): Promise<SubscriptionOccurrence> {
        const occ = await this.connection.getEntityOrThrow(ctx, SubscriptionOccurrence, occId);
        if (occ.status !== 'pending') {
            throw new UserInputError('Only pending occurrence items can be set');
        }
        occ.sellerItemsJson = items;
        return this.connection.getRepository(ctx, SubscriptionOccurrence).save(occ);
    }

    /** 最后一期履约后进入续订待定；买家确认开启新一段（沿用 createSubscription）。 */
    async initiateRenewal(ctx: RequestContext, subscriptionId: ID): Promise<Subscription> {
        const subRepo = this.connection.getRepository(ctx, Subscription);
        const sub = await subRepo.findOne({ where: { id: Number(subscriptionId) } as any });
        if (!sub) {
            throw new UserInputError('Subscription not found');
        }
        sub.status = 'renewalPending';
        return subRepo.save(sub);
    }

    /** 取消：status → cancelled，并把所有 pending 期次 → cancelled。 */
    async cancelSubscription(ctx: RequestContext, subscriptionId: ID): Promise<Subscription> {
        const subRepo = this.connection.getRepository(ctx, Subscription);
        const sub = await subRepo.findOne({ where: { id: Number(subscriptionId) } as any });
        if (!sub) {
            throw new UserInputError('Subscription not found');
        }
        sub.status = 'cancelled';
        await subRepo.save(sub);
        const occRepo = this.connection.getRepository(ctx, SubscriptionOccurrence);
        const pendings = await occRepo.find({
            where: { subscriptionId: Number(subscriptionId), status: 'pending' } as any,
        });
        for (const occ of pendings) {
            occ.status = 'cancelled';
            await occRepo.save(occ);
        }
        return sub;
    }

    async customerSubscriptions(ctx: RequestContext, customerId: number, options?: ListOptions): Promise<{ items: Subscription[]; totalItems: number }> {
        const [items, totalItems] = await this.connection.getRepository(ctx, Subscription).findAndCount({
            where: { channelId: ctx.channelId as number, customerId } as any,
            order: { createdAt: 'DESC' },
            skip: options?.skip ?? 0,
            take: options?.take ?? 50,
        });
        return { items, totalItems };
    }

    async occurrencesOf(ctx: RequestContext, subscriptionId: ID, options?: ListOptions): Promise<{ items: SubscriptionOccurrence[]; totalItems: number }> {
        const [items, totalItems] = await this.connection.getRepository(ctx, SubscriptionOccurrence).findAndCount({
            where: { channelId: ctx.channelId as number, subscriptionId: Number(subscriptionId) } as any,
            order: { periodNo: 'ASC' },
            skip: options?.skip ?? 0,
            take: options?.take ?? 50,
        });
        return { items, totalItems };
    }

    async shopPlans(ctx: RequestContext, options?: ListOptions): Promise<{ items: SubscriptionPlan[]; totalItems: number }> {
        const shop = await this.requireMyShop(ctx);
        const [items, totalItems] = await this.connection.getRepository(ctx, SubscriptionPlan).findAndCount({
            where: { channelId: ctx.channelId as number, shopId: shop.id as number } as any,
            order: { createdAt: 'DESC' },
            skip: options?.skip ?? 0,
            take: options?.take ?? 50,
        });
        return { items, totalItems };
    }

    async allPlans(ctx: RequestContext, options?: ListOptions): Promise<{ items: SubscriptionPlan[]; totalItems: number }> {
        const [items, totalItems] = await this.connection.getRepository(ctx, SubscriptionPlan).findAndCount({
            where: { channelId: ctx.channelId as number, enabled: true } as any,
            order: { createdAt: 'DESC' },
            skip: options?.skip ?? 0,
            take: options?.take ?? 50,
        });
        return { items, totalItems };
    }

    async createPlan(ctx: RequestContext, input: any): Promise<SubscriptionPlan> {
        const shop = await this.requireMyShop(ctx);
        const plan = new SubscriptionPlan({
            channelId: ctx.channelId as number,
            shopId: shop.id as number,
            ...input,
            enabled: input.enabled ?? true,
        } as any);
        return this.connection.getRepository(ctx, SubscriptionPlan).save(plan);
    }

    /** JobQueue handler 入口：对给定 channel 扫一次到期期次。 */
    async runDaily(ctx: RequestContext): Promise<{ created: number; skipped: number }> {
        return this.processDueOccurrences(ctx);
    }

    private async requireMyShop(ctx: RequestContext): Promise<Shop> {
        // 复用 shop-plugin 阶段18 账权语义（Shop.administratorId 归属 + active 校验）。
        if (!ctx.activeUserId) {
            throw new ForbiddenError();
        }
        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId);
        if (!admin || admin.id == null) {
            throw new ForbiddenError();
        }
        const shop = await this.connection
            .getRepository(ctx, Shop)
            .findOne({ where: { administratorId: admin.id as number } as any });
        if (!shop || shop.status !== 'active') {
            throw new ForbiddenError();
        }
        return shop;
    }
}