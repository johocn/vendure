import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';

import { CouponBindingService } from './coupon-binding.service';

/**
 * 商品绑券后台管理（admin-api）：查询商品下全部绑定（含停用）、创建/更新/删除绑定。
 * 权限与券模板管理一致（Permission.UpdateOrder），租户隔离在 service 内按渠道过滤。
 */
@Resolver()
export class CouponBindingAdminResolver {
    constructor(private bindingService: CouponBindingService) {}

    @Query()
    @Allow(Permission.UpdateOrder)
    async productCouponBindings(@Ctx() ctx: RequestContext, @Args('productId') productId: ID) {
        return this.bindingService.listByProductAdmin(ctx, Number(productId));
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async createProductCouponBinding(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.bindingService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async updateProductCouponBinding(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.bindingService.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async deleteProductCouponBinding(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        await this.bindingService.delete(ctx, id);
        return true;
    }
}
