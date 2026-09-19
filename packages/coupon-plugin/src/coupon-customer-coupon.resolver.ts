import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { CustomerService, Ctx, RequestContext } from '@vendure/core';

import { CouponService } from './coupon.service';

/**
 * CustomerCoupon.template 关系字段解析。
 * claimCoupon / grantCouponIssue 返回的实例未预加载 template 关联，
 * 若无字段解析器则 GraphQL 输出 template:null。此处按 templateId 补查并复用
 * findOneTemplate（顺带应用本地化与属店隔离，shop 会话下 adminShopId 为 undefined 不拦截）。
 */
@Resolver('CustomerCoupon')
export class CustomerCouponResolver {
    constructor(
        private couponService: CouponService,
        private customerService: CustomerService,
    ) {}

    @ResolveField('template')
    async template(@Parent() cc: any, @Ctx() ctx: RequestContext) {
        if (cc.template) return cc.template;
        if (cc.templateId == null) return null;
        return this.couponService.findOneTemplate(ctx, cc.templateId);
    }

    /** 领取/核销明细需要客户名/手机号（管理后台展示用），未命中返回 null */
    @ResolveField('customer')
    async customer(@Parent() cc: any, @Ctx() ctx: RequestContext) {
        if (cc.customerId == null) return null;
        return this.customerService.findOne(ctx, cc.customerId);
    }
}