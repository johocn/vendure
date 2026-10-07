import { Args, ID as GqlID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { PaymentTimeoutAdminService } from './payment-timeout-admin.service';

/** 待付款超时任务的运营后台查询 / 统计 / 手动执行（权限按订单读写走） */
@Resolver()
export class PaymentTimeoutAdminResolver {
    constructor(private admin: PaymentTimeoutAdminService) {}

    @Query()
    @Allow(Permission.ReadOrder as any)
    async paymentTimeoutTasks(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
        @Args({ name: 'type', type: () => String, nullable: true }) type?: string,
        @Args({ name: 'from', type: () => Date, nullable: true }) from?: Date,
        @Args({ name: 'to', type: () => Date, nullable: true }) to?: Date,
        @Args({ name: 'skip', type: () => Int, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Int, nullable: true }) take?: number,
    ) {
        return this.admin.listTasks({ status, type, from, to, skip, take });
    }

    @Query()
    @Allow(Permission.ReadOrder as any)
    async paymentTimeoutStats(@Ctx() ctx: RequestContext) {
        return this.admin.getStats();
    }

    @Mutation()
    @Allow(Permission.UpdateOrder as any)
    async executePaymentTimeoutTask(@Ctx() ctx: RequestContext, @Args({ name: 'id', type: () => GqlID }) id: ID) {
        return this.admin.executeTask(Number(id));
    }

    @Mutation()
    @Allow(Permission.UpdateOrder as any)
    async resendPaymentTimeoutRemind(@Ctx() ctx: RequestContext, @Args({ name: 'taskId', type: () => GqlID }) taskId: ID) {
        return this.admin.resendRemind(Number(taskId));
    }

    @Mutation()
    @Allow(Permission.UpdateOrder as any)
    async runPaymentTimeoutCompensation(@Ctx() ctx: RequestContext) {
        return this.admin.runCompensationNow();
    }
}
