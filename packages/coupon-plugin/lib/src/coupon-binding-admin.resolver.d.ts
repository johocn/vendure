import { ID, RequestContext } from '@vendure/core';
import { CouponBindingService } from './coupon-binding.service';
/**
 * 商品绑券后台管理（admin-api）：查询商品下全部绑定（含停用）、创建/更新/删除绑定。
 * 权限与券模板管理一致（Permission.UpdateOrder），租户隔离在 service 内按渠道过滤。
 */
export declare class CouponBindingAdminResolver {
    private bindingService;
    constructor(bindingService: CouponBindingService);
    productCouponBindings(ctx: RequestContext, productId: ID): Promise<import("./product-coupon-binding.entity").ProductCouponBinding[]>;
    createProductCouponBinding(ctx: RequestContext, input: any): Promise<import("./product-coupon-binding.entity").ProductCouponBinding>;
    updateProductCouponBinding(ctx: RequestContext, input: any): Promise<import("./product-coupon-binding.entity").ProductCouponBinding>;
    deleteProductCouponBinding(ctx: RequestContext, id: ID): Promise<boolean>;
}
