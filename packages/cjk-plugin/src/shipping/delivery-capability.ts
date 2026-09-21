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

const PICKUP_MODES = new Set(['pickup', 'store', 'employee']);

/** 档案的方法行 → 去重后的能力集合（MAIL 恒排在 SELF_PICKUP 之前，便于稳定比较） */
export function modesFromMethodConfigs(
    configs: Array<{ mode?: string | null }> | null | undefined,
): DeliveryMode[] {
    let mail = false;
    let pickup = false;
    for (const c of configs ?? []) {
        if (PICKUP_MODES.has(String(c?.mode ?? ''))) pickup = true;
        else mail = true;
    }
    const out: DeliveryMode[] = [];
    if (mail) out.push('MAIL');
    if (pickup) out.push('SELF_PICKUP');
    return out;
}

export function bothSupported(modes: DeliveryMode[]): boolean {
    return modes.includes('MAIL') && modes.includes('SELF_PICKUP');
}

/**
 * 由档案方法行解析能力。档案不存在 / 无任何方法行 → 回退「两者都支持」，
 * 保持旧行为不误伤（与既有「空 deliveryMethods = 两者都支持」的兜底一致）。
 */
export function capabilityFromMethodConfigs(
    configs: Array<{ mode?: string | null }> | null | undefined,
): DeliveryCapability {
    const modes = modesFromMethodConfigs(configs);
    if (modes.length === 0) {
        return { modes: ['MAIL', 'SELF_PICKUP'], bothSupported: true, source: 'fallback' };
    }
    return { modes, bothSupported: bothSupported(modes), source: 'profile' };
}

/** 多个档案的能力并集（渠道级能力 = 渠道内全部生效档案的并集） */
export function unionCapability(
    list: Array<Array<{ mode?: string | null }> | null | undefined>,
): DeliveryCapability {
    const flat: Array<{ mode?: string | null }> = [];
    for (const configs of list) flat.push(...(configs ?? []));
    return capabilityFromMethodConfigs(flat);
}
