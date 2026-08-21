import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { VoucherBooking } from './voucher-booking.entity';
import { ServiceVoucher } from './service-voucher.entity';
import { VoucherService } from './voucher.service';

/**
 * 管理端券接口。核销/延期/换券均经 service 层 requireMyShop 校验当前活跃用户为 active 店主
 * （归属隔离由 Shop.administratorId 把关），因此 schema 侧仅需 Authenticated 保底，
 * 真正的授权由 requireMyShop 兜底。
 */
@Resolver()
export class VoucherAdminResolver {
    constructor(private service: VoucherService) {}

    /** 扫码展示：店主按 code 查回本店券。 */
    @Query()
    @Allow(Permission.Authenticated)
    async scanVoucher(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
    ): Promise<ServiceVoucher | undefined> {
        return this.service.findVoucher(ctx, code);
    }

    /** 管理端全局券列表（本 channel）。 */
    @Query()
    @Allow(Permission.Authenticated)
    async myVouchersAdmin(@Ctx() ctx: RequestContext): Promise<ServiceVoucher[]> {
        return this.service.vouchers(ctx);
    }

    /** 某券的预约档。 */
    @Query()
    @Allow(Permission.Authenticated)
    async voucherBookings(
        @Ctx() ctx: RequestContext,
        @Args('voucherId') voucherId: ID,
    ): Promise<VoucherBooking[]> {
        return this.service.bookingsForVoucher(ctx, voucherId);
    }

    /** 店主核销：usable → used。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async redeemVoucher(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
    ): Promise<ServiceVoucher> {
        return this.service.redeemVoucher(ctx, code);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async extendVoucher(
        @Ctx() ctx: RequestContext,
        @Args('voucherId') voucherId: ID,
        @Args('days') days: number,
    ): Promise<ServiceVoucher> {
        return this.service.extendVoucher(ctx, voucherId, days);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async exchangeVoucher(
        @Ctx() ctx: RequestContext,
        @Args('voucherId') voucherId: ID,
    ): Promise<ServiceVoucher> {
        return this.service.exchangeVoucher(ctx, voucherId);
    }

    /** 创建预约档（幂等：一券一档）。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async createBooking(
        @Ctx() ctx: RequestContext,
        @Args('voucherId') voucherId: ID,
        @Args('slotAt') slotAt: Date,
        @Args('customerCount') customerCount: number,
    ): Promise<VoucherBooking> {
        return this.service.createBooking(ctx, voucherId, slotAt, customerCount);
    }

    /** 触发过期扫描（或由 JobQueue 定时调用）。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async runExpireScan(@Ctx() ctx: RequestContext): Promise<number> {
        return this.service.markExpired(ctx);
    }
}