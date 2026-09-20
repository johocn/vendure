/**
 * 会员价规则作用域：
 * - global：按 memberLevel 全局生效
 * - category：按 memberLevel + categoryId 生效，priority 高于 global
 */
export type MemberPriceRuleScope = 'global' | 'category';
export declare class MemberPriceRule {
    id: number;
    channelId: number;
    scope: MemberPriceRuleScope;
    /**
     * 仅 scope='category' 时使用；scope='global' 时为 null。
     */
    categoryId: number | null;
    /**
     * 会员等级 1-5，对应 member-level-plugin 的 memberLevel。
     */
    memberLevel: number;
    /**
     * 折扣百分比（整数 95 = 95 折）。范围 1-100。
     */
    discountPercent: number;
    active: boolean;
    /**
     * 优先级：category 默认 100，global 默认 10；数字大者优先。
     */
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}
