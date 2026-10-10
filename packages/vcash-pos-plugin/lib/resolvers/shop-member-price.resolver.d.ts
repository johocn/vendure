import { CustomerService, ID, RequestContext } from '@vendure/core';
import { Connection } from 'typeorm';
import { MemberPriceRuleService } from '../services/member-price-rule.service';
/**
 * C 端商品会员价展示结果（只读展示，不参与下单计价）。
 * - applied: 是否命中会员价规则（discountPercent < 100）
 * - discountPercent: 命中时的折扣（95 = 95 折），未命中为 null
 */
export declare class ProductMemberPrice {
    productId: string;
    applied: boolean;
    discountPercent: number | null;
}
/**
 * Shop API：当前登录会员在指定商品上的会员价标签查询。
 * - 未登录 / 无顾客档案 / 等级无效 → 返回空数组
 * - 商品不存在 / 未配置规则 / 未命中 → applied: false
 * 纯查询，不改价格链路（下单合计仍走既有订单级促销）。
 */
export declare class ShopMemberPriceResolver {
    private connection;
    private customerService;
    private ruleService;
    constructor(connection: Connection, customerService: CustomerService, ruleService: MemberPriceRuleService);
    myMemberPrice(ctx: RequestContext, productIds: ID[]): Promise<ProductMemberPrice[]>;
    /**
     * 解析商品主分类：与 MemberPriceCalculator（variant.collections 第一个）保持一致，
     * 商品级取第一个 variant 的第一个 Collection（按 id 排序保证确定性）。
     */
    private resolveProductCategoryId;
}
