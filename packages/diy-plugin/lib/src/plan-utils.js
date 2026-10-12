"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coverMaterialIds = coverMaterialIds;
exports.derivePlanTitle = derivePlanTitle;
exports.inferRenderPreset = inferRenderPreset;
/** 画廊封面素材 id：spec.slots 的 materialId 去重取前 3 */
function coverMaterialIds(spec) {
    var _a;
    const seen = new Set();
    for (const slot of Object.values((_a = spec === null || spec === void 0 ? void 0 : spec.slots) !== null && _a !== void 0 ? _a : {})) {
        if (slot === null || slot === void 0 ? void 0 : slot.materialId) {
            seen.add(slot.materialId);
        }
        if (seen.size >= 3) {
            break;
        }
    }
    return [...seen];
}
/**
 * 画廊/公开页标题派生：bom 快照素材名（创建时已本地化）去重串联 + 手围 cm，
 * 如「南红青金 · 16cm」；无 bom/无素材名回退「DIY 方案」；手围缺失则只出素材名段。
 */
function derivePlanTitle(spec, bom) {
    var _a, _b, _c;
    const names = [];
    for (const item of (_a = bom === null || bom === void 0 ? void 0 : bom.items) !== null && _a !== void 0 ? _a : []) {
        if (item.name && !names.includes(item.name)) {
            names.push(item.name);
        }
        if (names.length >= 2) {
            break;
        }
    }
    if (names.length === 0) {
        return 'DIY 方案';
    }
    const wristSize = Number((_c = (_b = spec === null || spec === void 0 ? void 0 : spec.params) === null || _b === void 0 ? void 0 : _b.wristSize) !== null && _c !== void 0 ? _c : 0);
    const suffix = wristSize > 0 ? ` · ${Math.round(wristSize / 10)}cm` : '';
    return names.join('') + suffix;
}
/**
 * 渲染预设推断（populate 脚本与素材导入共用）。按素材名关键词匹配，
 * 顺序敏感：翡翠（无「玉」字）先于玉系、青金先于金属（「金」字冲突）。
 */
function inferRenderPreset(name) {
    const n = String(name !== null && name !== void 0 ? name : '');
    if (n.includes('翡翠')) {
        return 'jade-flower';
    }
    if (n.includes('玉')) {
        return 'jade';
    }
    if (n.includes('琉璃') || n.includes('玻璃') || n.includes('水晶')) {
        return 'glass';
    }
    if (n.includes('蜜蜡') || n.includes('琥珀')) {
        return 'amber';
    }
    if (n.includes('珍珠')) {
        return 'pearl';
    }
    if (n.includes('南红') || n.includes('玛瑙') || n.includes('青金') || n.includes('砭石')) {
        return 'matte';
    }
    // wood 先于 metal：金刚菩提/菩提根等含「金/木」字样，避免被金属规则截胡
    if (n.includes('椰壳') || n.includes('木') || n.includes('菩提') || n.includes('竹')) {
        return 'wood';
    }
    if (/金|银|铜|k$/i.test(n)) {
        return 'metal';
    }
    return 'matte';
}
//# sourceMappingURL=plan-utils.js.map