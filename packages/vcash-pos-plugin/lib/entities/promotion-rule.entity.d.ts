/**
 * 促销规则类型：
 * - fullReduction: 满减（满 X 减 Y，可阶梯）
 * - discount: 整单折扣（X 折）
 * - buyGift: 买赠（买 N 送 M）
 */
export type PromotionType = 'fullReduction' | 'discount' | 'buyGift';
/**
 * 作用域：
 * - global: 全局生效
 * - collection: 仅对指定 collection 内商品生效（buyGift 用 buyVariantId 判定，scope=collection 时额外校验 buyVariantId 属于该 collection）
 */
export type PromotionScope = 'global' | 'collection';
export declare class PromotionRule {
    id: number;
    channelId: number;
    type: PromotionType;
    name: string;
    description: string | null;
    scope: PromotionScope;
    collectionId: number | null;
    /**
     * 全局唯一优先级，数字大者优先；同 saving 取 priority 大者。
     */
    priority: number;
    active: boolean;
    startTime: Date | null;
    endTime: Date | null;
    /**
     * 按 type 不同（JSON 字符串）：
     * - fullReduction: { tiers: [{ threshold, reduction }, ...] }
     * - discount: { minOrderValue?: number }
     * - buyGift: { buyVariantId, buyQuantity }
     */
    conditions: any | null;
    /**
     * 按 type 不同（JSON 字符串）：
     * - fullReduction: null（reduction 写在 conditions.tiers）
     * - discount: { discountPercent: number }
     * - buyGift: { giftVariantId, giftQuantity }
     */
    actions: any | null;
    createdAt: Date;
    updatedAt: Date;
}
