import { RequestContext } from '@vendure/core';
import { CouponBundle } from './coupon-bundle.entity';
import { CouponSaleService } from './coupon-sale.service';
/**
 * CouponBundle 输出字段解析：name / description 为 LocalizedText，按当前会话语言求值输出；
 * items 经 CouponSaleService 按包 id 展开。admin 与 shop 两套 schema 均注册（各自入口独立）。
 */
export declare class CouponBundleResolver {
    private couponSaleService;
    constructor(couponSaleService: CouponSaleService);
    name(bundle: CouponBundle, ctx: RequestContext): string;
    description(bundle: CouponBundle, ctx: RequestContext): string | null;
    items(bundle: CouponBundle, ctx: RequestContext): Promise<import("./coupon-bundle.entity").CouponBundleItem[]>;
}
