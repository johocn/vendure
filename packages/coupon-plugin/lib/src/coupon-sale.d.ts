/**
 * 券出售相关的纯函数（无 IO、SSR 可用）：
 * 退款判定、券包展开、出售目录过滤。
 */
/**
 * 出售单可退判定：出售单生成的券中「没有任何一张状态为 USED」即可退。
 * 过期券（EXPIRED）与回退券（RETURNED）均视为未使用（设计 §16-5：过期券可退）。
 * 空集合（异常数据，无券可回收）→ 拒绝，避免空退款。
 */
export declare function isSaleOrderRefundable(statuses: ReadonlyArray<string | null | undefined>): boolean;
/**
 * 券包展开：把 [{templateId, quantity}] 展开为逐张的 templateId 序列。
 * quantity 缺省 / 非法 / 小于 1 时按 1 张处理。
 */
export declare function expandBundleItems(items: ReadonlyArray<{
    templateId: number;
    quantity?: number | null;
}>): number[];
/** 出售目录过滤：仅保留 salePrice > 0 的可售模板（0 / null = 不可售）。 */
export declare function filterSaleCatalogue<T extends {
    salePrice?: number | null;
}>(templates: ReadonlyArray<T>): T[];
/**
 * 到手价重算（下单唯一信任源，纯函数）：
 * 学生价（仅单券，需认证通过）与首购立减（单券+券包）各自从原价计算、取低不叠加；
 * 到手价最低 1 分（避免 0 元单）。返回终价 + 优惠类型 + 让利额。
 */
export declare function resolvePromoPrice(base: number, opts: {
    studentPrice?: number | null;
    studentApproved: boolean;
    firstBuyEligible: boolean;
    firstBuyDiscount: number;
}): {
    final: number;
    discountType: 'FIRST_BUY' | 'STUDENT' | null;
    discountAmount: number;
};
