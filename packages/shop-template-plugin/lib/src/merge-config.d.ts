export declare function deepMerge(base: any, override: any): any;
/**
 * 展开 L2 模板的 theme.palette：scheme → 预设 tokens，再叠加显式 palette.tokens。
 * 无 scheme / 未知 scheme / 坏数据 → {}（回退上一级），与 C 端 resolvePaletteTokens 同语义。
 */
export declare function resolvePaletteTokens(palette: any): Record<string, any>;
/**
 * 合并预览：L1 全局配置 → L2 模板（palette 展开 + 显式 theme/pages）→ L3 店铺覆盖。
 * 注意：入参 template 为「已扁平化」的 L2（theme 的键与 pages 的键同处顶层，palette 为顶层键）。
 */
export declare function mergePreview(globalConfig: any, template: any, overrides: any): {
    merged: any;
    sourceByKey: Record<string, string>;
};
