import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';

import { manageOwnShop } from '@vendure/shop-plugin';

import { CouponService } from './coupon.service';
import { InStoreBillService } from './in-store-bill.service';
import { VERIFY_ORDER_PERMISSION } from './redeem-scope';

/**
 * 到店买单（admin-api）：商户端核销 + 流水查询。
 * `@Allow` 为 OR 语义：平台管理员走 UpdateOrder，店主走 ManageOwnShop，
 * 受限核销员（销售员）走 VerifyOrder。属店隔离由 service 内的 assertManagedByShop（券模板）二次把关，
 * 受限核销员的配送档案范围由 InStoreBillService.locate 把关。
 * 流水/汇总按 ctx.channelId（登录租户）隔离，对店主开放（本租户全量）；
 * 受限核销员强制 `operatorId = ctx.activeUserId`（只看自己经手）。
 */
@Resolver()
export class InStoreBillAdminResolver {
    constructor(
        private inStoreBillService: InStoreBillService,
        private couponService: CouponService,
    ) {}

    /** 到店收银：某顾客在当前渠道可到店核销的券列表（仅看场景 IN_STORE/ALL + 未使用/未过期） */
    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission, VERIFY_ORDER_PERMISSION)
    async inStoreCustomerCoupons(@Ctx() ctx: RequestContext, @Args('customerId') customerId: ID) {
        return this.couponService.listInStoreCoupons(ctx, Number(customerId));
    }

    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission, VERIFY_ORDER_PERMISSION)
    async inStoreBillQuote(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('originalAmount', { type: () => Int, nullable: true }) originalAmount?: number,
    ) {
        return this.inStoreBillService.quote(ctx, code, originalAmount ?? null);
    }

    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission, VERIFY_ORDER_PERMISSION)
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
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission, VERIFY_ORDER_PERMISSION)
    async inStoreBillSummary(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options?: any) {
        return this.inStoreBillService.summary(ctx, {
            from: options?.from ? new Date(options.from) : undefined,
            to: options?.to ? new Date(options.to) : undefined,
        });
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission, VERIFY_ORDER_PERMISSION)
    async inStoreBillRedeem(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('originalAmount', { type: () => Int }) originalAmount: number,
        @Args('remark', { nullable: true }) remark?: string,
    ) {
        return this.inStoreBillService.redeem(ctx, code, originalAmount, remark);
    }
}
