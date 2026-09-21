/**
 * 配送能力派生（唯一真源）。
 *
 * 能力真源 = ShippingProfileMethod.mode（不是商品/仓库的手工字段）：
 *   - 'mail'                         → MAIL（快递邮寄）
 *   - 'pickup' | 'store' | 'employee' → SELF_PICKUP（到店/自提点/职工单位自提）
 * 其它未知值按 Mail 类处理（与 ShippingProfileService.isPickupMode 的语义互补：
 * 那边「非自提即邮寄」，这边保持同一口径）。
 */
export type DeliveryMode = 'MAIL' | 'SELF_PICKUP';
export interface DeliveryCapability {
    modes: DeliveryMode[];
    bothSupported: boolean;
    source: 'profile' | 'fallback';
}
/** 档案的方法行 → 去重后的能力集合（MAIL 恒排在 SELF_PICKUP 之前，便于稳定比较） */
export declare function modesFromMethodConfigs(configs: Array<{
    mode?: string | null;
}> | null | undefined): DeliveryMode[];
export declare function bothSupported(modes: DeliveryMode[]): boolean;
/**
 * 由档案方法行解析能力。档案不存在 / 无任何方法行 → 回退「两者都支持」，
 * 保持旧行为不误伤（与既有「空 deliveryMethods = 两者都支持」的兜底一致）。
 */
export declare function capabilityFromMethodConfigs(configs: Array<{
    mode?: string | null;
}> | null | undefined): DeliveryCapability;
/** 多个档案的能力并集（渠道级能力 = 渠道内全部生效档案的并集） */
export declare function unionCapability(list: Array<Array<{
    mode?: string | null;
}> | null | undefined>): DeliveryCapability;
