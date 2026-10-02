import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { CouponBundle } from './coupon-bundle.entity';
import { CouponSaleService } from './coupon-sale.service';
import { localizeText } from './localize';

/**
 * CouponBundle 输出字段解析：name / description 为 LocalizedText，按当前会话语言求值输出；
 * items 经 CouponSaleService 按包 id 展开。admin 与 shop 两套 schema 均注册（各自入口独立）。
 */
@Resolver('CouponBundle')
export class CouponBundleResolver {
    constructor(private couponSaleService: CouponSaleService) {}

    @ResolveField('name')
    name(@Parent() bundle: CouponBundle, @Ctx() ctx: RequestContext): string {
        return localizeText(bundle.name as any, ctx.languageCode, '');
    }

    @ResolveField('description')
    description(@Parent() bundle: CouponBundle, @Ctx() ctx: RequestContext): string | null {
        const v = (bundle as any).description;
        if (v == null) {
            return null;
        }
        return localizeText(v, ctx.languageCode, '') || null;
    }

    @ResolveField('items')
    items(@Parent() bundle: CouponBundle, @Ctx() ctx: RequestContext) {
        return this.couponSaleService.listBundleItems(ctx, bundle.id);
    }
}