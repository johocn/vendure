import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';

import { CouponService } from './coupon.service';
import { InStoreBillService } from './in-store-bill.service';

/**
 * 到店买单（admin-api）：商户端核销 + 流水查询。
 * 权限沿用 coupon-plugin 范式：@Allow(Permission.UpdateOrder)，
 * 属店隔离由 service 内的 assertManagedByShop（券模板）+ ctx.channelId（流水）共同保证。
 */
@Resolver()
export class InStoreBillAdminResolver {
    constructor(
        private inStoreBillService: InStoreBillService,
        private couponService: CouponService,
    ) {}

    /** 到店收银：某顾客在当前渠道可到店核销的券列表（仅看场景 IN_STORE/ALL + 未使用/未过期） */
    @Query()
    @Allow(Permission.UpdateOrder)
    async inStoreCustomerCoupons(@Ctx() ctx: RequestContext, @Args('customerId') customerId: ID) {
        return this.couponService.listInStoreCoupons(ctx, Number(customerId));
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async inStoreBillQuote(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('originalAmount', { type: () => Int, nullable: true }) originalAmount?: number,
    ) {
        return this.inStoreBillService.quote(ctx, code, originalAmount ?? null);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async inStoreBills(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options?: any) {
        return this.inStoreBillService.list(ctx, {
            skip: options?.skip ?? 0,
            take: options?.take ?? 20,
            couponCode: options?.couponCode ?? undefined,
            from: options?.from ? new Date(options.from) : undefined,
            to: options?.to ? new Date(options.to) : undefined,
        });
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async inStoreBillSummary(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options?: any) {
        return this.inStoreBillService.summary(ctx, {
            from: options?.from ? new Date(options.from) : undefined,
            to: options?.to ? new Date(options.to) : undefined,
        });
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async inStoreBillRedeem(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('originalAmount', { type: () => Int }) originalAmount: number,
        @Args('remark', { nullable: true }) remark?: string,
    ) {
        return this.inStoreBillService.redeem(ctx, code, originalAmount, remark);
    }
}
