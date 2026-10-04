import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { RiderService } from './rider.service';
import { CampusPermissions } from './permissions';

@Resolver()
export class RiderAdminResolver {
    constructor(private riderService: RiderService) {}

    @Query()
    @Allow(CampusPermissions.CampusAuditRider as any)
    async riderApplications(@Ctx() ctx: RequestContext, @Args('status') status: string) {
        return this.riderService.listApplications(ctx, status);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusAuditRider as any)
    async campusSetRiderStatus(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('status') status: 'approved' | 'suspended' | 'none',
    ) {
        return this.riderService.setRiderStatus(ctx, Number(customerId), status);
    }
}
