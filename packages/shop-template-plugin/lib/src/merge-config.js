"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepMerge = deepMerge;
exports.resolvePaletteTokens = resolvePaletteTokens;
exports.mergePreview = mergePreview;
/**
 * 五级合并模型深合并（数组/标量直接覆盖、null 跳过、对象递归）。
 * 与 C 端 vshop/src/utils/merge-config.ts、nshop/layers/base/app/utils/merge-config.ts 语义一致，供合并预览复用。
 */
const palette_presets_1 = require("./palette-presets");
function deepMerge(base, override) {
    if (override === null || override === undefined)
        return base;
    if (base === null || base === undefined)
        return override;
    if (typeof base !== 'object' || typeof override !== 'object')
        return override;
    if (Array.isArray(base) || Array.isArray(override))
        return override;
    const out = Object.assign({}, base);
    for (const k of Object.keys(override)) {
        out[k] = deepMerge(base[k], override[k]);
    }
    return out;
}
/**
 * 展开 L2 模板的 theme.palette：scheme → 预设 tokens，再叠加显式 palette.tokens。
 * 无 scheme / 未知 scheme / 坏数据 → {}（回退上一级），与 C 端 resolvePaletteTokens 同语义。
 */
function resolvePaletteTokens(palette) {
    var _a, _b;
    if (!palette || typeof palette !== 'object')
        return {};
    const preset = typeof palette.scheme === 'string' ? palette_presets_1.PALETTE_PRESETS[palette.scheme] : undefined;
    return deepMerge(deepMerge({}, (_a = preset === null || preset === void 0 ? void 0 : preset.tokens) !== null && _a !== void 0 ? _a : {}), (_b = palette.tokens) !== null && _b !== void 0 ? _b : {});
}
/**
 * 合并预览：L1 全局配置 → L2 模板（palette 展开 + 显式 theme/pages）→ L3 店铺覆盖。
 * 注意：入参 template 为「已扁平化」的 L2（theme 的键与 pages 的键同处顶层，palette 为顶层键）。
 */
function mergePreview(globalConfig, template, overrides) {
    const paletteTokens = resolvePaletteTokens(template === null || template === void 0 ? void 0 : template.palette);
    const l2 = deepMerge(deepMerge({}, paletteTokens), template !== null && template !== void 0 ? template : {});
    const merged = deepMerge(deepMerge(globalConfig !== null && globalConfig !== void 0 ? globalConfig : {}, l2), overrides !== null && overrides !== void 0 ? overrides : {});
    const sourceByKey = {};
    const walk = (obj, path, src) => {
        if (!obj || typeof obj !== 'object')
            return;
        for (const k of Object.keys(obj)) {
            const p = path ? `${path}.${k}` : k;
            sourceByKey[p] = src;
            if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                walk(obj[k], p, src);
            }
        }
    };
    // 顺序即优先级：后写覆盖先写 → L3 > L2 > L1
    walk(globalConfig !== null && globalConfig !== void 0 ? globalConfig : {}, '', 'L1');
    walk(paletteTokens, '', 'L2');
    walk(template !== null && template !== void 0 ? template : {}, '', 'L2');
    walk(overrides !== null && overrides !== void 0 ? overrides : {}, '', 'L3');
    return { merged, sourceByKey };
}
//# sourceMappingURL=merge-config.js.map