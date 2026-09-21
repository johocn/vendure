"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SAFETY_STOCK = void 0;
exports.resolveSafetyStock = resolveSafetyStock;
/** 渠道无默认值时的兜底安全库存（与设计规格一致，不要再改这个常量） */
exports.DEFAULT_SAFETY_STOCK = 10;
const asId = (v) => String(v !== null && v !== void 0 ? v : '');
/** 规整为「非负整数」；非法值退回常量 10 */
function norm(value) {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(0, v) : exports.DEFAULT_SAFETY_STOCK;
}
/**
 * 安全库存四级回退（纯函数，可单测）：
 *   SKU×仓规则(enabled) → SKU 全仓规则(locationId=0, enabled) → 渠道 inventoryDefaultSafetyStock → 常量 10
 *
 * `locationId` 为空/`0` 表示「聚合视图 / 全仓通用」口径：跳过仓级规则，直接看全仓规则。
 */
function resolveSafetyStock(input) {
    var _a;
    const vid = asId(input.variantId);
    const lid = asId(input.locationId) || '0';
    const enabled = ((_a = input.rules) !== null && _a !== void 0 ? _a : []).filter(r => r && r.enabled !== false);
    if (lid !== '0') {
        const exact = enabled.find(r => asId(r.variantId) === vid && asId(r.locationId) === lid);
        if (exact) {
            return norm(exact.safetyStock);
        }
    }
    const all = enabled.find(r => asId(r.variantId) === vid && asId(r.locationId) === '0');
    if (all) {
        return norm(all.safetyStock);
    }
    if (input.channelDefault !== null && input.channelDefault !== undefined) {
        const def = Number(input.channelDefault);
        if (Number.isFinite(def)) {
            return norm(def);
        }
    }
    return exports.DEFAULT_SAFETY_STOCK;
}
//# sourceMappingURL=alert-rule-math.js.map