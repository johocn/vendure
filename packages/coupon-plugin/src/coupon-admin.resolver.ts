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
    constructor(private couponService: CouponService) {}

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