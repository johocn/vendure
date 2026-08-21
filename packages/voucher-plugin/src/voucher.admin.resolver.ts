import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { ServiceVoucher } from './service-voucher.entity';
import { VoucherService } from './voucher.service';

/**
 * 管理端券接口。核销/延期/换券均经 service 层 requireMyShop 校验当前活跃用户为 active 店主
 * （归属隔离由 Shop.administratorId 把关），schema 侧以 UpdateSettings 保底授权。
 */
@Resolver()
export class VoucherAdminResolver {
    constructor(private service: VoucherService) {}

    /** 扫码展示：店主按 code 查回本店券。 */
    @Query()
    @Allow(Permission.UpdateSettings)
    async scanVoucher(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
    ): Promise<ServiceVoucher | undefined> {
        return this.service.findVoucher(ctx, code);
    }

    /** 管理端全局券列表（本 channel）。 */
    @Query()
    @Allow(Permission.UpdateSettings)
    async myVouchersAdmin(@Ctx() ctx: RequestContext): Promise<ServiceVoucher[]> {
        return this.service.vouchers(ctx);
    }

    /** 店主核销：usable → used。 */
    @Mutation()
    @Allow(Permission.UpdateSettings)
    async redeemVoucher(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
    ): Promise<ServiceVoucher> {
        return this.service.redeemVoucher(ctx, code);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async extendVoucher(
        @Ctx() ctx: RequestContext,
        @Args('voucherId') voucherId: ID,
        @Args('days') days: number,
    ): Promise<ServiceVoucher> {
        return this.service.extendVoucher(ctx, voucherId, days);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async exchangeVoucher(
        @Ctx() ctx: RequestContext,
        @Args('voucherId') voucherId: ID,
    ): Promise<ServiceVoucher> {
        return this.service.exchangeVoucher(ctx, voucherId);
    }

    /** 触发过期扫描（或由 JobQueue 定时调用）。 */
    @Mutation()
    @Allow(Permission.UpdateSettings)
    async runExpireScan(@Ctx() ctx: RequestContext): Promise<number> {
        return this.service.markExpired(ctx);
    }
}