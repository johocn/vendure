/**
 * 五级合并模型深合并（数组/标量直接覆盖、null 跳过、对象递归）。
 * 与 C 端 vshop/src/utils/merge-config.ts、nshop/layers/base/app/utils/merge-config.ts 语义一致，供合并预览复用。
 */
import { PALETTE_PRESETS } from './palette-presets';

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

/**
 * 展开 L2 模板的 theme.palette：scheme → 预设 tokens，再叠加显式 palette.tokens。
 * 无 scheme / 未知 scheme / 坏数据 → {}（回退上一级），与 C 端 resolvePaletteTokens 同语义。
 */
export function resolvePaletteTokens(palette: any): Record<string, any> {
    if (!palette || typeof palette !== 'object') return {};
    const preset = typeof palette.scheme === 'string' ? PALETTE_PRESETS[palette.scheme] : undefined;
    return deepMerge(deepMerge({}, preset?.tokens ?? {}), palette.tokens ?? {});
}

/**
 * 合并预览：L1 全局配置 → L2 模板（palette 展开 + 显式 theme/pages）→ L3 店铺覆盖。
 * 注意：入参 template 为「已扁平化」的 L2（theme 的键与 pages 的键同处顶层，palette 为顶层键）。
 */
export function mergePreview(
    globalConfig: any,
    template: any,
    overrides: any,
): { merged: any; sourceByKey: Record<string, string> } {
    const paletteTokens = resolvePaletteTokens(template?.palette);
    const l2 = deepMerge(deepMerge({}, paletteTokens), template ?? {});
    const merged = deepMerge(deepMerge(globalConfig ?? {}, l2), overrides ?? {});

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
    // 顺序即优先级：后写覆盖先写 → L3 > L2 > L1
    walk(globalConfig ?? {}, '', 'L1');
    walk(paletteTokens, '', 'L2');
    walk(template ?? {}, '', 'L2');
    walk(overrides ?? {}, '', 'L3');
    return { merged, sourceByKey };
}