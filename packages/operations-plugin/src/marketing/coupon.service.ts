import { Injectable } from '@nestjs/common';
import {
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
        return this.couponService.enableCouponForChannel(ctx, id);
    }

    async disableForChannel(ctx: RequestContext, id: ID): Promise<any> {
        this.assertPermission(ctx);
        return this.couponService.disableCouponForChannel(ctx, id);
    }
}
