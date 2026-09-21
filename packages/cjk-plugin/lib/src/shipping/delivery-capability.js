"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modesFromMethodConfigs = modesFromMethodConfigs;
exports.bothSupported = bothSupported;
exports.capabilityFromMethodConfigs = capabilityFromMethodConfigs;
exports.unionCapability = unionCapability;
const PICKUP_MODES = new Set(['pickup', 'store', 'employee']);
/** 档案的方法行 → 去重后的能力集合（MAIL 恒排在 SELF_PICKUP 之前，便于稳定比较） */
function modesFromMethodConfigs(configs) {
    var _a;
    let mail = false;
    let pickup = false;
    for (const c of configs !== null && configs !== void 0 ? configs : []) {
        if (PICKUP_MODES.has(String((_a = c === null || c === void 0 ? void 0 : c.mode) !== null && _a !== void 0 ? _a : '')))
            pickup = true;
        else
            mail = true;
    }
    const out = [];
    if (mail)
        out.push('MAIL');
    if (pickup)
        out.push('SELF_PICKUP');
    return out;
}
function bothSupported(modes) {
    return modes.includes('MAIL') && modes.includes('SELF_PICKUP');
}
/**
 * 由档案方法行解析能力。档案不存在 / 无任何方法行 → 回退「两者都支持」，
 * 保持旧行为不误伤（与既有「空 deliveryMethods = 两者都支持」的兜底一致）。
 */
function capabilityFromMethodConfigs(configs) {
    const modes = modesFromMethodConfigs(configs);
    if (modes.length === 0) {
        return { modes: ['MAIL', 'SELF_PICKUP'], bothSupported: true, source: 'fallback' };
    }
    return { modes, bothSupported: bothSupported(modes), source: 'profile' };
}
/** 多个档案的能力并集（渠道级能力 = 渠道内全部生效档案的并集） */
function unionCapability(list) {
    const flat = [];
    for (const configs of list)
        flat.push(...(configs !== null && configs !== void 0 ? configs : []));
    return capabilityFromMethodConfigs(flat);
}
//# sourceMappingURL=delivery-capability.js.map