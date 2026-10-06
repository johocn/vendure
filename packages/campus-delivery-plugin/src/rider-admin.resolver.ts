import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { RiderService } from './rider.service';
import { CampusPermissions } from './permissions';
import { RiderWalletService } from './rider-wallet.service';

@Resolver()
export class RiderAdminResolver {
    constructor(
        private riderService: RiderService,
        private wallet: RiderWalletService,
    ) {}

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

    /** 骑手提现申请列表（status=ALL/PENDING/PAID/REJECTED，渠道隔离） */
    @Query()
    @Allow(CampusPermissions.CampusAuditRider as any)
    async riderWithdrawals(
        @Ctx() ctx: RequestContext,
        @Args('status', { nullable: true }) status?: string,
        @Args('skip', { nullable: true }) skip?: number,
        @Args('take', { nullable: true }) take?: number,
    ) {
        return this.wallet.adminList(ctx, status, skip, take);
    }

    /** 通过：标记 PAID 留痕（金额已在申请时冻结扣减） */
    @Mutation()
    @Allow(CampusPermissions.CampusAuditRider as any)
    async approveRiderWithdraw(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('remark', { nullable: true }) remark?: string,
    ) {
        return this.wallet.adminApprove(ctx, id, remark);
    }

    /** 驳回：状态 REJECTED 并退回冻结金额 */
    @Mutation()
    @Allow(CampusPermissions.CampusAuditRider as any)
    async rejectRiderWithdraw(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('remark', { nullable: true }) remark?: string,
    ) {
        return this.wallet.adminReject(ctx, id, remark);
    }
}
