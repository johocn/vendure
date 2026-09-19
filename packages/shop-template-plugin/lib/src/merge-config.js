"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepMerge = deepMerge;
exports.mergePreview = mergePreview;
/**
 * 五级合并模型深合并（数组/标量直接覆盖、null 跳过、对象递归）。
 * 与前端 vshop/src/utils/merge-config.ts 语义一致，供合并预览复用。
 */
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
/** 合并预览：L1 全局配置 → L2 模板 → L3 店铺覆盖，返回 { merged, sourceByKey } */
function mergePreview(globalConfig, // L1 themeTokens/defaults
template, // L2 theme/pages
overrides) {
    const merged = deepMerge(deepMerge(globalConfig !== null && globalConfig !== void 0 ? globalConfig : {}, template !== null && template !== void 0 ? template : {}), overrides !== null && overrides !== void 0 ? overrides : {});
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
    walk(overrides !== null && overrides !== void 0 ? overrides : {}, '', 'L3');
    walk(template !== null && template !== void 0 ? template : {}, '', 'L2');
    walk(globalConfig !== null && globalConfig !== void 0 ? globalConfig : {}, '', 'L1');
    return { merged, sourceByKey };
}
//# sourceMappingURL=merge-config.js.map