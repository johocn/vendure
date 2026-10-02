"use strict";
/**
 * 券出售相关的纯函数（无 IO、SSR 可用）：
 * 退款判定、券包展开、出售目录过滤。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSaleOrderRefundable = isSaleOrderRefundable;
exports.expandBundleItems = expandBundleItems;
exports.filterSaleCatalogue = filterSaleCatalogue;
/**
 * 出售单可退判定：出售单生成的券中「没有任何一张状态为 USED」即可退。
 * 过期券（EXPIRED）与回退券（RETURNED）均视为未使用（设计 §16-5：过期券可退）。
 * 空集合（异常数据，无券可回收）→ 拒绝，避免空退款。
 */
function isSaleOrderRefundable(statuses) {
    if (statuses.length === 0) {
        return false;
    }
    return statuses.every(s => s !== 'USED');
}
/**
 * 券包展开：把 [{templateId, quantity}] 展开为逐张的 templateId 序列。
 * quantity 缺省 / 非法 / 小于 1 时按 1 张处理。
 */
function expandBundleItems(items) {
    var _a;
    const out = [];
    for (const item of items) {
        const qty = Math.max(1, Math.floor(Number((_a = item.quantity) !== null && _a !== void 0 ? _a : 1)) || 1);
        for (let i = 0; i < qty; i++) {
            out.push(item.templateId);
        }
    }
    return out;
}
/** 出售目录过滤：仅保留 salePrice > 0 的可售模板（0 / null = 不可售）。 */
function filterSaleCatalogue(templates) {
    return templates.filter(t => { var _a; return Number((_a = t.salePrice) !== null && _a !== void 0 ? _a : 0) > 0; });
}
//# sourceMappingURL=coupon-sale.js.map