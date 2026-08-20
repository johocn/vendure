import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, ListQueryOptions, RequestContext, Transaction } from '@vendure/core';

import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';

@Resolver()
export class CouponAdminResolver {
    constructor(private couponService: CouponService) {}

    @Query()
    async couponTemplates(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<CouponTemplate>,
    ) {
        return this.couponService.findAllTemplates(ctx, options);
    }

    @Query()
    async couponTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponService.findOneTemplate(ctx, id);
    }

    @Query()
    async customerCoupons(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<CustomerCoupon>,
    ) {
        return this.couponService.listAllCoupons(ctx, options);
    }

    @Mutation()
    @Transaction()
    async createCouponTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.couponService.createTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    async updateCouponTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.couponService.updateTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    async deleteCouponTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        await this.couponService.deleteTemplate(ctx, id);
        return true;
    }

    @Mutation()
    @Transaction()
    async grantCoupon(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
        @Args('customerIds') customerIds: ID[],
    ): Promise<string[]> {
        return this.couponService.grantCoupon(ctx, templateId, customerIds);
    }

    @Mutation()
    @Transaction()
    async revokeCustomerCoupon(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.couponService.revokeCoupon(ctx, id);
    }
}