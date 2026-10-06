import { Args, ID as GqlID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { DispatchAdminService, ExceptionAction } from './dispatch-admin.service';
import { CampusPermissions } from './permissions';

@Resolver()
export class DispatchAdminResolver {
    constructor(private dispatchAdmin: DispatchAdminService) {}

    @Query()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusDispatchBoard(@Ctx() ctx: RequestContext) {
        return this.dispatchAdmin.board(ctx);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusAssignOrder(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('riderCustomerId') riderCustomerId: ID,
    ) {
        return this.dispatchAdmin.assign(ctx, orderId, riderCustomerId);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusBackToHall(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.dispatchAdmin.backToHall(ctx, orderId);
    }

    /** 异常处置（plan 3.4）：reassign 回大厅 / refund_diff 退差价 / coupon 发补偿券 / refund_all 全额退单 */
    @Mutation()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusHandleException(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('action') action: ExceptionAction,
        @Args({ name: 'amount', type: () => Int, nullable: true }) amount?: number,
        @Args({ name: 'couponTemplateId', type: () => GqlID, nullable: true }) couponTemplateId?: ID,
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string,
    ) {
        return this.dispatchAdmin.handleException(ctx, orderId, action, amount, couponTemplateId, note);
    }
}
