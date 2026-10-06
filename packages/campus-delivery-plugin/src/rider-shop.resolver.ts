import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { CampusConfigService } from './campus-config.service';
import { RiderService } from './rider.service';
import { RiderWalletService } from './rider-wallet.service';

@Resolver()
export class RiderShopResolver {
    constructor(
        private riderService: RiderService,
        private configService: CampusConfigService,
        private capacity: CapacityService,
        private wallet: RiderWalletService,
    ) {}

    /** 需登录：service 内部校验当前顾客，未登录抛 ForbiddenError。 */
    @Mutation()
    async applyRider(
        @Ctx() ctx: RequestContext,
        @Args('realName') realName: string,
        @Args('studentNo') studentNo: string,
        @Args('campus') campus: string,
        @Args('idImg', { nullable: true }) idImg?: string,
    ) {
        return this.riderService.applyRider(ctx, { realName, studentNo, campus, idImg });
    }

    @Query()
    async myRiderProfile(@Ctx() ctx: RequestContext) {
        return this.riderService.myRiderProfile(ctx);
    }

    /** 骑手钱包：可用余额 / 冻结中 / 累计收入 */
    @Query()
    async myRiderWallet(@Ctx() ctx: RequestContext) {
        return this.wallet.myRiderWallet(ctx);
    }

    /** 余额流水（含分成入账/充值/消费/提现冻结/退回） */
    @Query()
    async riderBalanceHistory(
        @Ctx() ctx: RequestContext,
        @Args('skip', { nullable: true }) skip?: number,
        @Args('take', { nullable: true }) take?: number,
    ) {
        return this.wallet.riderBalanceHistory(ctx, skip, take);
    }

    /** 本人提现申请记录 */
    @Query()
    async riderWithdrawRequests(
        @Ctx() ctx: RequestContext,
        @Args('skip', { nullable: true }) skip?: number,
        @Args('take', { nullable: true }) take?: number,
    ) {
        return this.wallet.riderWithdrawRequests(ctx, skip, take);
    }

    /** 提现申请：金额（分）+ 收款渠道 + 账号，提交即冻结 */
    @Mutation()
    async riderWithdraw(
        @Ctx() ctx: RequestContext,
        @Args('amount') amount: number,
        @Args('channel') channel: string,
        @Args('account') account: string,
    ) {
        return this.wallet.riderWithdraw(ctx, { amount, channel, account });
    }

    /** 骑手上下线开关（大厅轮询页 15s 轮询续命） */
    @Mutation()
    async campusRiderOnline(@Ctx() ctx: RequestContext, @Args('online') online: boolean) {
        return this.riderService.setOnline(ctx, online);
    }

    /** 骑手心跳（30s 定时调），带骑手资格校验 */
    @Mutation()
    async campusRiderHeartbeat(@Ctx() ctx: RequestContext) {
        return this.capacity.heartbeat(ctx);
    }

    /** T0 运力预检：C 端下单前提示「运力紧张」 */
    @Query()
    async campusCapacityCheck(@Ctx() ctx: RequestContext) {
        return this.capacity.capacityCheck(ctx);
    }

    // 公开只读：C 端选楼用
    @Query()
    async campusZones(@Ctx() ctx: RequestContext) {
        return this.configService.listZones(ctx);
    }

    @Query()
    async campusBuildings(@Ctx() ctx: RequestContext, @Args({ name: 'zoneId', nullable: true }) zoneId?: ID) {
        return this.configService.listBuildings(zoneId != null ? Number(zoneId) : undefined);
    }
}
