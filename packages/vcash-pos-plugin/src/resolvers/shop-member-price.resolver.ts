import { Inject } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, CustomerService, ID, Product, RequestContext } from '@vendure/core';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, In } from 'typeorm';

import { MemberPriceRuleService } from '../services/member-price-rule.service';

/**
 * C 端商品会员价展示结果（只读展示，不参与下单计价）。
 * - applied: 是否命中会员价规则（discountPercent < 100）
 * - discountPercent: 命中时的折扣（95 = 95 折），未命中为 null
 */
export class ProductMemberPrice {
  productId!: string;
  applied!: boolean;
  discountPercent: number | null = null;
}

/**
 * Shop API：当前登录会员在指定商品上的会员价标签查询。
 * - 未登录 / 无顾客档案 / 等级无效 → 返回空数组
 * - 商品不存在 / 未配置规则 / 未命中 → applied: false
 * 纯查询，不改价格链路（下单合计仍走既有订单级促销）。
 */
@Resolver()
export class ShopMemberPriceResolver {
  constructor(
    @InjectConnection() private connection: Connection,
    @Inject(CustomerService) private customerService: CustomerService,
    @Inject(MemberPriceRuleService) private ruleService: MemberPriceRuleService,
  ) {}

  @Query()
  async myMemberPrice(
    @Ctx() ctx: RequestContext,
    @Args('productIds') productIds: ID[],
  ): Promise<ProductMemberPrice[]> {
    if (!ctx.activeUserId || productIds.length === 0) return [];
    const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
    if (!customer) return [];
    // 与 MemberPriceCalculator 一致：memberLevel 缺省按 1 档
    const memberLevel: number = (customer as any).customFields?.memberLevel ?? 1;
    if (!memberLevel || memberLevel < 1) return [];

    const ids = productIds
      .map(id => parseInt(String(id), 10))
      .filter(v => Number.isFinite(v));
    if (ids.length === 0) return [];
    const products = await this.connection.getRepository(Product).find({
      where: { id: In(ids) },
      relations: ['variants', 'variants.collections'],
    });
    const byId = new Map<number, Product>(products.map(p => [Number(p.id), p]));

    const out: ProductMemberPrice[] = [];
    for (const rawId of productIds) {
      const numId = parseInt(String(rawId), 10);
      const product = Number.isFinite(numId) ? byId.get(numId) : undefined;
      if (!product) {
        out.push({ productId: String(rawId), applied: false, discountPercent: null });
        continue;
      }
      const categoryId = this.resolveProductCategoryId(product);
      const rule = await this.ruleService.findEffectiveRule(ctx, memberLevel, categoryId);
      const applied = !!rule && rule.discountPercent < 100;
      out.push({
        productId: String(rawId),
        applied,
        discountPercent: applied ? rule!.discountPercent : null,
      });
    }
    return out;
  }

  /**
   * 解析商品主分类：与 MemberPriceCalculator（variant.collections 第一个）保持一致，
   * 商品级取第一个 variant 的第一个 Collection（按 id 排序保证确定性）。
   */
  private resolveProductCategoryId(product: Product): number | null {
    const variants = [...(product.variants ?? [])].sort(
      (a, b) => Number(a.id) - Number(b.id),
    );
    for (const variant of variants) {
      const collections = [...((variant as any).collections ?? [])].sort(
        (a, b) => Number(a.id) - Number(b.id),
      );
      if (collections.length > 0) return Number(collections[0].id);
    }
    return null;
  }
}
