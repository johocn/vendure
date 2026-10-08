import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    ID,
    Injector,
    ListQueryBuilder,
    ListQueryOptions,
    Order,
    OrderService,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { RENTAL_PLUGIN_OPTIONS } from './constants';
import { RentalPlan } from './rental-plan.entity';
import { createRentalSchedule, tryGetScheduleService } from './rental-schedule-bridge';
import { RentalPluginOptions } from './types';

const RENT_UNITS: ReadonlyArray<string> = ['day', 'week', 'month'];
const PAYMENT_MODES: ReadonlyArray<string> = ['prepaid', 'postpaid'];

@Injectable()
export class RentalService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private orderService: OrderService,
        private moduleRef: ModuleRef,
        @Inject(RENTAL_PLUGIN_OPTIONS) private options: RentalPluginOptions,
    ) {}

    private repo(ctx: RequestContext) {
        return this.connection.getRepository(ctx, RentalPlan);
    }

    async findAll(ctx: RequestContext, options?: ListQueryOptions<RentalPlan>): Promise<PaginatedList<RentalPlan>> {
        return this.listQueryBuilder
            .build(RentalPlan, options, { ctx, channelId: ctx.channelId, relations: ['channels'] })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findByVariant(ctx: RequestContext, variantId: ID): Promise<RentalPlan[]> {
        return this.repo(ctx)
            .createQueryBuilder('plan')
            .innerJoin('plan.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId })
            .where('plan.variantId = :vid', { vid: Number(variantId) })
            .andWhere('plan.enabled = :enabled', { enabled: true })
            .getMany();
    }

    async findOne(ctx: RequestContext, id: ID): Promise<RentalPlan | undefined> {
        return (await this.repo(ctx).findOne({ where: { id: id as any } })) ?? undefined;
    }

    async create(ctx: RequestContext, input: Partial<RentalPlan>): Promise<RentalPlan> {
        this.assertValid(input);
        const plan = new RentalPlan(input as any);
        plan.channels = [ctx.channel];
        return this.repo(ctx).save(plan);
    }

    async update(ctx: RequestContext, input: any): Promise<RentalPlan> {
        const plan = await this.repo(ctx).findOne({ where: { id: input.id } });
        if (!plan) {
            throw new UserInputError(`RentalPlan ${input.id} not found`);
        }
        const merged = { ...plan, ...input };
        this.assertValid(merged);
        Object.assign(plan, input);
        return this.repo(ctx).save(plan);
    }

    async delete(ctx: RequestContext, id: ID): Promise<void> {
        await this.repo(ctx).delete(id);
    }

    private get defaultGraceHours(): number {
        return this.options.defaultGraceHours ?? 72;
    }

    /**
     * 结算页选择租赁：校验归属/状态/含对应商品行 → 生成期次实例（押金 + 租金）。
     * 注：RequestContext 无 injector 属性（本仓 Vendure 3.6 实装），
     * 经注入的 ModuleRef 构造 Injector（同 installment 场景手法）。
     */
    async startRental(ctx: RequestContext, orderId: ID, planId: ID, periods: number): Promise<Order> {
        const order = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'customer.user',
            // hasLines 校验需 lines.productVariant（findOne 不默认加载 lines）
            'lines',
            'lines.productVariant',
        ]);
        if (!order) {
            throw new UserInputError(`Order ${orderId} not found`);
        }
        if ((order as any)?.customer?.user?.id !== ctx.activeUserId) {
            throw new UserInputError('You can only start rental on your own order');
        }
        if (order.state !== 'ArrangingPayment') {
            throw new UserInputError(`Order state ${order.state} does not allow starting a rental`);
        }
        if (!Number.isInteger(periods) || periods < 1 || periods > 36) {
            throw new UserInputError('periods must be an integer between 1 and 36');
        }
        const plan = await this.findOne(ctx, planId);
        if (!plan || !plan.enabled) {
            throw new UserInputError(`RentalPlan ${planId} not found or disabled`);
        }
        const hasLines = (order as any)?.lines?.some(
            (l: any) => String(l.productVariant?.id) === String(plan.variantId),
        );
        if (!hasLines) {
            throw new UserInputError('Order does not contain the rental variant');
        }
        await createRentalSchedule(ctx, new Injector(this.moduleRef), order, plan, periods, this.defaultGraceHours);
        return (await this.orderService.findOne(ctx, orderId)) as Order;
    }

    /**
     * 租期付清后的所有权买断：按下单快照买断价扣除已付租金，追加 buyout 期次（payable，date now）。
     * 买断款随后经 paySchedulePeriod 支付——调度被 addScheduleItem 拉回 in_progress，
     * 订单处于 PaymentSettled 也可付（PAYABLE_SOURCE_STATES 含 PaymentSettled，见 Task 4）。
     */
    async buyoutRental(ctx: RequestContext, orderId: ID): Promise<{ scheduleId: number; seq: number; amount: number }> {
        const scheduleService = tryGetScheduleService(new Injector(this.moduleRef));
        if (!scheduleService) {
            throw new UserInputError('Payment schedule plugin is not available');
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) {
            throw new UserInputError(`Order ${orderId} not found`);
        }
        if ((order as any)?.customer?.user?.id !== ctx.activeUserId) {
            throw new UserInputError('You can only buy out your own rental');
        }
        const withItems = await scheduleService.getScheduleForOrder(ctx, orderId, { requireOwner: true });
        if (!withItems || withItems.schedule.scenario !== 'rental') {
            throw new UserInputError('Order has no rental schedule');
        }
        if (!['in_progress', 'completed'].includes(withItems.schedule.status)) {
            throw new UserInputError(`Schedule status ${withItems.schedule.status} does not allow buyout`);
        }
        const rental = ((withItems.schedule as any).meta ?? {}).rental;
        if (!rental?.allowBuyout || rental?.buyoutPrice == null) {
            throw new UserInputError('Buyout is not allowed for this rental');
        }
        const paidRent = withItems.items
            .filter((i: any) => i.kind === 'rent' && i.status === 'paid')
            .reduce((sum: number, i: any) => sum + i.amount, 0);
        const amount = Math.max(0, rental.buyoutPrice - paidRent);
        if (amount <= 0) {
            throw new UserInputError('Paid rent already covers the buyout price');
        }
        const added = await scheduleService.addScheduleItem(ctx, withItems.schedule.id, {
            kind: 'buyout',
            amount,
            trigger: { type: 'date', at: new Date().toISOString() },
        });
        const buyoutItem = added.items.find((i: any) => i.kind === 'buyout');
        return { scheduleId: withItems.schedule.id, seq: buyoutItem.seq, amount: buyoutItem.amount };
    }

    /** 参数硬校验（押金/租金必须为正；买断价可为 null 但不可为负） */
    private assertValid(plan: Partial<RentalPlan>): void {
        if (plan.depositAmount != null && plan.depositAmount <= 0) {
            throw new UserInputError('depositAmount must be > 0');
        }
        if (plan.rentAmount != null && plan.rentAmount <= 0) {
            throw new UserInputError('rentAmount must be > 0');
        }
        if (plan.rentUnit != null && !RENT_UNITS.includes(plan.rentUnit)) {
            throw new UserInputError('rentUnit must be day/week/month');
        }
        if (plan.prepaidOrPostpaid != null && !PAYMENT_MODES.includes(plan.prepaidOrPostpaid)) {
            throw new UserInputError('prepaidOrPostpaid must be prepaid/postpaid');
        }
        if (plan.buyoutPrice != null && plan.buyoutPrice < 0) {
            throw new UserInputError('buyoutPrice must be >= 0');
        }
    }
}
