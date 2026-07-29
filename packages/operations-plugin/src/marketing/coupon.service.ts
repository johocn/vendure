import { Injectable } from '@nestjs/common';
import {
    EntityNotFoundError,
    ForbiddenError,
    ID,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
} from '@vendure/core';
import { CouponService } from '@vendure/coupon-plugin';

import { OperationsPermissions } from '../constants';

@Injectable()
export class CouponMarketingService {
    constructor(private couponService: CouponService) {}

    private assertPermission(ctx: RequestContext): void {
        if (!ctx.userHasPermissions([OperationsPermissions.ManageCoupon as any])) {
            throw new ForbiddenError();
        }
    }

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<any>,
    ): Promise<PaginatedList<any>> {
        this.assertPermission(ctx);
        return this.couponService.getCoupons(ctx, options as any);
    }

    async findOne(ctx: RequestContext, id: ID): Promise<any | null> {
        this.assertPermission(ctx);
        return this.couponService.getCoupon(ctx, id);
    }

    async create(ctx: RequestContext, input: any): Promise<any> {
        this.assertPermission(ctx);
        return this.couponService.createCoupon(ctx, input);
    }

    async update(ctx: RequestContext, id: ID, input: any): Promise<any> {
        this.assertPermission(ctx);
        return this.couponService.updateCoupon(ctx, id, input);
    }

    async delete(ctx: RequestContext, id: ID): Promise<boolean> {
        this.assertPermission(ctx);
        return this.couponService.deleteCoupon(ctx, id);
    }

    async enableForChannel(ctx: RequestContext, id: ID): Promise<any> {
        this.assertPermission(ctx);
        const coupon = await this.couponService.getCoupon(ctx, id);
        if (!coupon) throw new EntityNotFoundError('Coupon' as any, id);
        let result: any;
        if (coupon.isGlobal) {
            result = await this.couponService.enableCouponForChannel(ctx, id);
        } else if (!coupon.isActive) {
            // 非全局券：通过 isActive 启停
            result = await this.couponService.updateCoupon(ctx, id, { isActive: true });
        } else {
            result = coupon;
        }
        return this.attachEnabledInCurrentChannel(ctx, result);
    }

    async disableForChannel(ctx: RequestContext, id: ID): Promise<any> {
        this.assertPermission(ctx);
        const coupon = await this.couponService.getCoupon(ctx, id);
        if (!coupon) throw new EntityNotFoundError('Coupon' as any, id);
        let result: any;
        if (coupon.isGlobal) {
            result = await this.couponService.disableCouponForChannel(ctx, id);
        } else {
            // 非全局券：通过 isActive 启停
            result = await this.couponService.updateCoupon(ctx, id, { isActive: false });
        }
        return this.attachEnabledInCurrentChannel(ctx, result);
    }

    /**
     * MarketingCoupon schema 类型没有 enabledInCurrentChannel 字段解析器，
     * 需在 service 层计算并附加到返回对象上，供 GraphQL 直接读取。
     */
    private attachEnabledInCurrentChannel(ctx: RequestContext, coupon: any): any {
        if (!coupon) return coupon;
        if (!coupon.isGlobal) {
            coupon.enabledInCurrentChannel = true;
        } else {
            coupon.enabledInCurrentChannel = !!(coupon.channels?.some((ch: any) => ch.id === ctx.channelId));
        }
        return coupon;
    }
}
