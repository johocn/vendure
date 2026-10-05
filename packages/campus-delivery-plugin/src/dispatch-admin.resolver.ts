import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { DispatchAdminService } from './dispatch-admin.service';
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
}
