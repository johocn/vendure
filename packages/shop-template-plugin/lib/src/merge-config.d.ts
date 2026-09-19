/**
 * 五级合并模型深合并（数组/标量直接覆盖、null 跳过、对象递归）。
 * 与前端 vshop/src/utils/merge-config.ts 语义一致，供合并预览复用。
 */
export declare function deepMerge(base: any, override: any): any;
/** 合并预览：L1 全局配置 → L2 模板 → L3 店铺覆盖，返回 { merged, sourceByKey } */
export declare function mergePreview(globalConfig: any, // L1 themeTokens/defaults
template: any, // L2 theme/pages
overrides: any): {
    merged: any;
    sourceByKey: Record<string, string>;
};
