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

import { INSTALLMENT_PLUGIN_OPTIONS } from './constants';
import { InstallmentPlan } from './installment-plan.entity';
import { createInstallmentSchedule } from './installment-schedule-bridge';
import { InstallmentPluginOptions } from './types';

const INTERVAL_UNITS: ReadonlyArray<string> = ['day', 'week', 'month'];

@Injectable()
export class InstallmentService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private orderService: OrderService,
        private moduleRef: ModuleRef,
        @Inject(INSTALLMENT_PLUGIN_OPTIONS) private options: InstallmentPluginOptions,
    ) {}

    private repo(ctx: RequestContext) {
        return this.connection.getRepository(ctx, InstallmentPlan);
    }

    async findAll(ctx: RequestContext, options?: ListQueryOptions<InstallmentPlan>): Promise<PaginatedList<InstallmentPlan>> {
        return this.listQueryBuilder
            .build(InstallmentPlan, options, { ctx, channelId: ctx.channelId, relations: ['channels'] })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findByVariant(ctx: RequestContext, variantId: ID): Promise<InstallmentPlan[]> {
        return this.repo(ctx)
            .createQueryBuilder('plan')
            .innerJoin('plan.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId })
            .where('plan.variantId = :vid', { vid: Number(variantId) })
            .andWhere('plan.enabled = :enabled', { enabled: true })
            .getMany();
    }

    async findOne(ctx: RequestContext, id: ID): Promise<InstallmentPlan | undefined> {
        return (await this.repo(ctx).findOne({ where: { id: id as any } })) ?? undefined;
    }

    async create(ctx: RequestContext, input: Partial<InstallmentPlan>): Promise<InstallmentPlan> {
        this.assertValid(input);
        const plan = new InstallmentPlan(input as any);
        plan.channels = [ctx.channel];
        return this.repo(ctx).save(plan);
    }

    async update(ctx: RequestContext, input: any): Promise<InstallmentPlan> {
        const plan = await this.repo(ctx).findOne({ where: { id: input.id } });
        if (!plan) {
            throw new UserInputError(`InstallmentPlan ${input.id} not found`);
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
     * 结算页启用分期：校验归属/状态/无既有期次 → 生成期次实例。
     * 注：RequestContext 无 injector 属性（本仓 Vendure 3.6 实装），
     * 经注入的 ModuleRef 构造 Injector（同 PaymentSchedulePlugin.onApplicationBootstrap 手法）。
     */
    async enableInstallment(ctx: RequestContext, orderId: ID, planId: ID): Promise<Order> {
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
            throw new UserInputError('You can only enable installment on your own order');
        }
        if (order.state !== 'ArrangingPayment') {
            throw new UserInputError(`Order state ${order.state} does not allow enabling installment`);
        }
        const plan = await this.findOne(ctx, planId);
        if (!plan || !plan.enabled) {
            throw new UserInputError(`InstallmentPlan ${planId} not found or disabled`);
        }
        const hasLines = (order as any)?.lines?.some(
            (l: any) => String(l.productVariant?.id) === String(plan.variantId),
        );
        if (!hasLines) {
            throw new UserInputError('Order does not contain the installment variant');
        }
        await createInstallmentSchedule(ctx, new Injector(this.moduleRef), order, plan, this.defaultGraceHours);
        return (await this.orderService.findOne(ctx, orderId)) as Order;
    }

    /** 参数硬校验（设计 §5：首付比 0-90 / 期数 1-36） */
    private assertValid(plan: Partial<InstallmentPlan>): void {
        if (plan.downPaymentRatio != null && (plan.downPaymentRatio < 0 || plan.downPaymentRatio > 90)) {
            throw new UserInputError('downPaymentRatio must be between 0 and 90');
        }
        if (plan.periods != null && (plan.periods < 1 || plan.periods > 36)) {
            throw new UserInputError('periods must be between 1 and 36');
        }
        if (plan.intervalUnit != null && !INTERVAL_UNITS.includes(plan.intervalUnit)) {
            throw new UserInputError('intervalUnit must be day/week/month');
        }
        if (plan.intervalCount != null && plan.intervalCount < 0) {
            throw new UserInputError('intervalCount must be >= 0');
        }
    }
}
