import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { GraphQLID } from 'graphql';
import { CampusPermissions } from './permissions';
import { RiderLedgerService } from './rider-ledger.service';

/** 骑手财务/轨迹只读查询（P8-4）：
 * 分成台账属财务对账 → CampusAuditRider；轨迹属调度追溯 → CampusViewDispatch。 */
@Resolver()
export class RiderLedgerAdminResolver {
    constructor(private ledger: RiderLedgerService) {}

    @Query()
    @Allow(CampusPermissions.CampusAuditRider as any)
    async campusRiderEarnings(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'from', type: () => String, nullable: true }) from?: string,
        @Args({ name: 'to', type: () => String, nullable: true }) to?: string,
        @Args({ name: 'riderCustomerId', type: () => String, nullable: true }) riderCustomerId?: string,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
        @Args({ name: 'orderCode', type: () => String, nullable: true }) orderCode?: string,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.ledger.earningsLedger(ctx, { from, to, riderCustomerId, status, orderCode, skip, take });
    }

    @Query()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusOrderRiderTrack(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'orderId', type: () => GraphQLID, nullable: true }) orderId?: ID,
        @Args({ name: 'orderCode', type: () => String, nullable: true }) orderCode?: string,
    ) {
        return this.ledger.orderTrack(ctx, orderId, orderCode);
    }

    @Query()
    @Allow(CampusPermissions.CampusViewDispatch as any)
    async campusRiderTrack(
        @Ctx() ctx: RequestContext,
        @Args('riderCustomerId') riderCustomerId: ID,
        @Args({ name: 'from', type: () => String }) from: string,
        @Args({ name: 'to', type: () => String }) to: string,
    ) {
        return this.ledger.riderTrack(ctx, riderCustomerId, from, to);
    }
}
