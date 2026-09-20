import { Order, OrderService, RequestContext, StockLevelService, TransactionalConnection } from '@vendure/core';
import { Connection } from 'typeorm';
import { PromotionRuleService } from './promotion-rule.service';
/**
 * 候选方案：会员价或某条促销规则。
 * - saving: 该方案给顾客省下的金额（分），用于排序选最优
 * - payload: 应用时需要的额外数据（如满减 tier、买赠 gift 价格），由 apply 使用
 */
export interface PromotionCandidate {
    ruleId: number | null;
    type: 'memberPrice' | 'fullReduction' | 'discount' | 'buyGift';
    saving: number;
    priority: number;
    payload?: any;
}
/**
 * 促销引擎：枚举候选 → 选最优 → 应用。
 * 互斥原则：会员价与所有促销规则两两互斥，取 saving 最大者；saving 相同 priority 大者优先。
 */
export declare class PromotionEngineService {
    private connection;
    private transactionalConnection;
    private ruleService;
    private orderService;
    private stockLevelService;
    constructor(connection: Connection, transactionalConnection: TransactionalConnection, ruleService: PromotionRuleService, orderService: OrderService, stockLevelService: StockLevelService);
    /**
     * 枚举所有候选方案（会员价 + active 规则），返回最优。
     * 若所有候选 saving ≤ 0 返回 null。
     * stockLocationId：用于买赠库存校验；为 null 时跳过库存校验（向后兼容）
     */
    calculateBest(ctx: RequestContext, order: Order, member: {
        id: number;
        customFields?: any;
    } | null, stockLocationId?: number | null): Promise<PromotionCandidate | null>;
    /**
     * 会员价候选：saving = sum over memberPriceApplied lines: (initialListPrice - listPrice) * quantity
     */
    private calculateMemberCandidate;
    private calculateRuleCandidate;
    /**
     * 满减：在 order.subTotal 上找最高满足的 tier，saving = reduction
     */
    private calculateFullReductionCandidate;
    /**
     * 整单折扣：若 subTotal < minOrderValue 返回 null；saving = floor(subTotal * (100 - dp) / 100)
     */
    private calculateDiscountCandidate;
    /**
     * 买赠：检查 order 是否命中 buyVariantId × buyQuantity；命中则 saving = giftVariant.price × giftQuantity
     * 库存校验：stockLocationId 非空时，检查 giftVariant 在该库存点的可用库存（stockOnHand - stockAllocated）≥ giftQuantity
     */
    private calculateBuyGiftCandidate;
    /**
     * 计算有效 subTotal（原价基准）：排除 isGift 行，用 initialListPrice 而非 listPrice
     * 因为 listPrice 可能已被会员价修改，互斥对比必须基于原价才公平
     */
    private computeEffectiveSubTotal;
    /**
     * 解析 Vendure ID（'T_1' → 1）
     */
    private parseId;
    /**
     * 撤销订单中所有 memberPriceApplied=true 行的 listPrice 到 initialListPrice。
     * 用于 winning 是促销规则（非会员价）时，确保顾客只享受促销优惠（互斥）。
     * 注意：仅恢复 listPrice，不重置 memberPriceApplied 标志（不影响 saving 计算，因 saving = initial - listPrice = 0）
     */
    private revertMemberPriceLines;
    /**
     * 重新应用促销：清理旧促销 → 计算 winning → 应用。
     * 返回更新后的 order。
     * customer 参数：可传 Customer 实体或轻量 { id } 对象，统一转 { id: number, customFields? }
     * stockLocationId：班次库存点 ID，用于买赠库存校验；null 时跳过校验
     */
    reapply(ctx: RequestContext, session: {
        customer: any | null;
        stockLocationId?: number | null;
    }, order: Order): Promise<Order>;
    /**
     * 清理旧促销：
     * 1. 删除所有 giftRuleId != null 的 OrderLine（buyGift 加的赠品行）
     * 2. 重置 order.customFields.promotionId/Type/Discount 为 null
     */
    private clearPreviousPromotion;
    private applyMember;
    private applyFullReduction;
    private applyDiscount;
    private applyBuyGift;
    private updateOrderPromotionFields;
}
