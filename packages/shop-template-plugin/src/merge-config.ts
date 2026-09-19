/**
 * 五级合并模型深合并（数组/标量直接覆盖、null 跳过、对象递归）。
 * 与前端 vshop/src/utils/merge-config.ts 语义一致，供合并预览复用。
 */
export function deepMerge(base: any, override: any): any {
    if (override === null || override === undefined) return base;
    if (base === null || base === undefined) return override;
    if (typeof base !== 'object' || typeof override !== 'object') return override;
    if (Array.isArray(base) || Array.isArray(override)) return override;
    const out: Record<string, any> = { ...base };
    for (const k of Object.keys(override)) {
        out[k] = deepMerge(base[k], override[k]);
    }
    return out;
}

/** 合并预览：L1 全局配置 → L2 模板 → L3 店铺覆盖，返回 { merged, sourceByKey } */
export function mergePreview(
    globalConfig: any,   // L1 themeTokens/defaults
    template: any,       // L2 theme/pages
    overrides: any,      // L3 店铺覆盖
): { merged: any; sourceByKey: Record<string, string> } {
    const merged = deepMerge(deepMerge(globalConfig ?? {}, template ?? {}), overrides ?? {});
    const sourceByKey: Record<string, string> = {};
    const walk = (obj: any, path: string, src: string) => {
        if (!obj || typeof obj !== 'object') return;
        for (const k of Object.keys(obj)) {
            const p = path ? `${path}.${k}` : k;
            sourceByKey[p] = src;
            if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                walk(obj[k], p, src);
            }
        }
    };
    walk(overrides ?? {}, '', 'L3');
    walk(template ?? {}, '', 'L2');
    walk(globalConfig ?? {}, '', 'L1');
    return { merged, sourceByKey };
}
