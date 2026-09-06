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

import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';

@Resolver()
export class CouponAdminResolver {
    constructor(private couponService: CouponService) {}

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponTemplates(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<CouponTemplate>,
    ) {
        return this.couponService.findAllTemplates(ctx, options);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async couponTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponService.findOneTemplate(ctx, id);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async customerCoupons(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<CustomerCoupon>,
    ) {
        return this.couponService.listAllCoupons(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async createCouponTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.couponService.createTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async updateCouponTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.couponService.updateTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async deleteCouponTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        await this.couponService.deleteTemplate(ctx, id);
        return true;
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async grantCoupon(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
        @Args('customerIds') customerIds: ID[],
    ): Promise<string[]> {
        return this.couponService.grantCoupon(ctx, templateId, customerIds);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async revokeCustomerCoupon(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponService.revokeCoupon(ctx, id);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
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
    @Allow(Permission.UpdateOrder)
    async grantCouponIssue(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
        @Args('customerIds', { type: () => [String] }) customerIds: ID[],
        @Args('notify') notify: boolean,
    ) {
        return this.couponService.grantCouponIssue(ctx, templateId, customerIds, notify);
    }
}