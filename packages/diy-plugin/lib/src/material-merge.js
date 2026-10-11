"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeMaterials = mergeMaterials;
exports.mergeCategories = mergeCategories;
exports.unionCategories = unionCategories;
/**
 * 两层素材合并（规格 §4.2）：
 * - 起点 = 平台库全集；
 * - 租户复制行按 sourceMaterialId 精确覆盖同源平台行（完全接管价/库存）；
 * - 无回链的租户行按 code 覆盖同货号平台行；
 * - 结果 = 未被覆盖的平台行 + 全部租户行（顺序：平台在前、租户在后）。
 */
function mergeMaterials(platform, tenant) {
    const shadowedIds = new Set();
    const shadowedCodes = new Set();
    for (const t of tenant) {
        if (t.sourceMaterialId != null) {
            shadowedIds.add(t.sourceMaterialId);
        }
        else {
            shadowedCodes.add(t.code);
        }
    }
    const keptPlatform = platform.filter(p => !shadowedIds.has(p.id) && !shadowedCodes.has(p.code));
    return [...keptPlatform, ...tenant];
}
/** 两层分类合并（规格 §4.1）：纯并集、无覆盖；排序责任在查询侧（ORDER BY sortOrder） */
function mergeCategories(platform, tenant) {
    return [...platform, ...tenant];
}
/** C 端分类并集（规格 §7）：平台 + 租户两层直拼，过滤 enabled 且有 code 的行，sortOrder/id 升序 */
function unionCategories(platform, tenant) {
    return [...platform, ...tenant]
        .filter(c => c.enabled && !!c.code)
        .sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
}
//# sourceMappingURL=material-merge.js.map