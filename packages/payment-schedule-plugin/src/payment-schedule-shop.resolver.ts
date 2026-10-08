import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext, Transaction } from '@vendure/core';

import { PaymentScheduleService, ScheduleWithItems } from './payment-schedule.service';

@Resolver()
export class PaymentScheduleShopResolver {
    constructor(private scheduleService: PaymentScheduleService) {}

    @Query()
    async paymentSchedule(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
    ): Promise<any | null> {
        const withItems = await this.scheduleService.getScheduleForOrder(ctx, orderId, { requireOwner: true });
        return withItems ? this.scheduleService.presentSchedule(withItems) : null;
    }

    @Mutation()
    @Transaction()
    async paySchedulePeriod(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('seq') seq: number,
        @Args('method') method: string,
    ): Promise<any> {
        const result: ScheduleWithItems = await this.scheduleService.paySchedulePeriod(ctx, orderId, seq, method);
        return this.scheduleService.presentSchedule(result);
    }

    @Mutation()
    @Transaction()
    async cancelSchedule(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('confirmForfeit', { nullable: true }) confirmForfeit?: boolean,
    ): Promise<any> {
        const result = await this.scheduleService.cancelSchedule(ctx, orderId, confirmForfeit ?? false);
        return this.scheduleService.presentSchedule(result);
    }
}
