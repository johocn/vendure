import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, ListQueryOptions, PaginatedList, RequestContext, Transaction } from '@vendure/core';

import { OrderPaymentSchedule } from './order-payment-schedule.entity';
import { PaymentScheduleService } from './payment-schedule.service';

@Resolver()
export class PaymentScheduleAdminResolver {
    constructor(private scheduleService: PaymentScheduleService) {}

    @Query()
    async paymentSchedules(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ListQueryOptions<OrderPaymentSchedule>,
    ): Promise<PaginatedList<any>> {
        const page = await this.scheduleService.listSchedules(ctx, options);
        const withItems = await Promise.all(
            page.items.map(async s => ({
                schedule: s,
                items: await this.scheduleService.findItemsForPresent(ctx, Number(s.id)),
            })),
        );
        return {
            items: withItems.map(w => this.scheduleService.presentSchedule(w as any)),
            totalItems: page.totalItems,
        };
    }

    @Query()
    async adminPaymentSchedule(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any | null> {
        const withItems = await this.scheduleService.getScheduleById(ctx, Number(id));
        return withItems ? this.scheduleService.presentSchedule(withItems) : null;
    }

    @Mutation()
    @Transaction()
    async openTailWindow(@Ctx() ctx: RequestContext, @Args('scheduleId') scheduleId: ID): Promise<any> {
        const result = await this.scheduleService.openTailWindow(ctx, Number(scheduleId));
        return this.scheduleService.presentSchedule(result);
    }

    @Mutation()
    @Transaction()
    async confirmSellerBreach(@Ctx() ctx: RequestContext, @Args('scheduleId') scheduleId: ID): Promise<any> {
        const result = await this.scheduleService.confirmSellerBreach(ctx, Number(scheduleId));
        return this.scheduleService.presentSchedule(result);
    }

    @Mutation()
    @Transaction()
    async confirmCodReceived(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID): Promise<any> {
        const result = await this.scheduleService.confirmCodReceived(ctx, orderId);
        return this.scheduleService.presentSchedule(result);
    }

    @Mutation()
    @Transaction()
    async releaseRentalDeposit(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID): Promise<any> {
        const result = await this.scheduleService.releaseDepositForRental(ctx, orderId);
        return this.scheduleService.presentSchedule(result);
    }

    /** 手动触发调度扫描（运维工具 + e2e 依赖；与每分钟 ScheduledTask 等价） */
    @Mutation()
    @Transaction()
    async runScheduleScan(@Ctx() ctx: RequestContext): Promise<{ activated: number; overdue: number; shipBreaches: number }> {
        const triggers = await this.scheduleService.processTriggers(ctx);
        const overdues = await this.scheduleService.processOverdue(ctx);
        const shipBreaches = await this.scheduleService.processShipDeadlines(ctx);
        return { activated: triggers.activated, overdue: overdues.overdue, shipBreaches };
    }
}
