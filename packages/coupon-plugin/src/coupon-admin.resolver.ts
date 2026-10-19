import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    ListQueryOptions,
    Permission,
    RequestContext,
    Transaction,
} from '@vendure/core';

import { manageOwnShop } from '@vendure/shop-plugin';

import { CouponService } from './coupon.service';
import { CouponFissionService } from './coupon-fission.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';

/**
 * 优惠券 admin 接口：平台管理员（UpdateOrder）与店主管理员（ManageOwnShop）共用同一 GraphQL 面。
 * `@Allow` 为 OR 语义（任一权限命中即放行），店主须能进入本 resolver，属店隔离再由
 * service 层 resolveShopIdFromActiveUser / assertManagedByShop 与列表过滤兜底；
 * 否则店主在权限闸门即被拒，service 内的隔离逻辑对店主不可达。
 */
@Resolver()
export class CouponAdminResolver {
    constructor(
        private couponService: CouponService,
        private fissionService: CouponFissionService,
    ) {}

    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async couponTemplates(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ListQueryOptions<CouponTemplate>,
    ) {
        return this.couponService.findAllTemplates(ctx, options);
    }

    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async couponTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponService.findOneTemplate(ctx, id);
    }

    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async customerCoupons(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ListQueryOptions<CustomerCoupon>,
    ) {
        return this.couponService.listAllCoupons(ctx, options);
    }

    /** 核销看板（FR-A3）：按模板聚合领券量/核销量/核销率/过期率，时间筛选按领取时间闭区间 */
    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async couponRedemptionStats(
        @Ctx() ctx: RequestContext,
        @Args('templateId', { nullable: true }) templateId?: string,
        @Args('from', { nullable: true, type: () => String }) from?: string,
        @Args('to', { nullable: true, type: () => String }) to?: string,
    ) {
        return this.couponService.couponRedemptionStats(ctx, {
            templateId: templateId != null ? Number(templateId) : null,
            from: from ? new Date(from) : null,
            to: to ? new Date(to) : null,
        });
    }

    /** E1 沉睡召回：圈人预览（只数不发） */
    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async couponWinBackPreviewCount(@Ctx() ctx: RequestContext, @Args('days', { nullable: false }) days: number) {
        return this.couponService.winBackPreviewCount(ctx, days);
    }

    /** E1 沉睡召回：批量发放（RECALL 渠道留痕 + R4 防骚扰），返回批次留痕 */
    @Mutation()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async couponWinBackGrant(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
        @Args('days', { nullable: false }) days: number,
        @Args('notify', { nullable: true }) notify?: boolean,
    ) {
        return this.couponService.winBackGrant(ctx, templateId, days, notify !== false);
    }

    /** E1 批次留痕查询（结果可查） */
    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async couponGrantBatches(@Ctx() ctx: RequestContext, @Args('take', { nullable: true }) take?: number) {
        return this.couponService.listGrantBatches(ctx, take ?? 20);
    }

    /** FR-C 裂变记录查询（R1 渠道留痕核对） */
    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async couponFissionRecords(@Ctx() ctx: RequestContext, @Args('take', { nullable: true }) take?: number) {
        return this.fissionService.listFissionRecords(ctx, take ?? 50);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async createCouponTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.couponService.createTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async updateCouponTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.couponService.updateTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async deleteCouponTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        await this.couponService.deleteTemplate(ctx, id);
        return true;
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async grantCoupon(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
        @Args('customerIds') customerIds: ID[],
    ): Promise<string[]> {
        return this.couponService.grantCoupon(ctx, templateId, customerIds);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async revokeCustomerCoupon(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponService.revokeCoupon(ctx, id);
    }

    @Query()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async couponChannelCustomers(
        @Ctx() ctx: RequestContext,
        @Args('query', { nullable: true }) query?: string,
        @Args('take', { nullable: true, type: () => Number }) take?: number,
        @Args('skip', { nullable: true, type: () => Number }) skip?: number,
    ) {
        return this.couponService.listChannelCustomers(ctx, query ?? undefined, take ?? 20, skip ?? 0);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder, manageOwnShop.Permission)
    async grantCouponIssue(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
        @Args('customerIds', { type: () => [String] }) customerIds: ID[],
        @Args('notify') notify: boolean,
    ) {
        return this.couponService.grantCouponIssue(ctx, templateId, customerIds, notify);
    }
}