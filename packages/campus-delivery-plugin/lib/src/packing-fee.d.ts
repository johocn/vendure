/**
 * 打包费/餐盒费（P1-1）报价：纯函数，C 端前端展示与后端结算落账共用同一口径。
 * - perItem（默认）：Σ(商品级覆盖单价 ?? 店铺单价) × 件数
 * - perOrder：每单固定金额（忽略商品级覆盖）
 * - cap 非空时单笔封顶
 */
/** 结算 surcharge 的幂等标记：按 sku 精确识别本插件写入的那一条，避免误删促销/其它 surcharge */
export declare const PACKING_FEE_SKU = "campus-packing-fee";
/** 计费方式白名单 */
export declare const PACKING_FEE_MODES: readonly ["perItem", "perOrder"];
export type PackingFeeMode = (typeof PACKING_FEE_MODES)[number];
/** 计费方式归一：null/非法值回 'perItem'（存量行与脏配置兜底） */
export declare function normalizePackingFeeMode(v: unknown): PackingFeeMode;
/** 默认展示名（店铺未自定义时） */
export declare const DEFAULT_PACKING_FEE_LABEL = "\u6253\u5305\u8D39";
export interface PackingFeeLineInput {
    /** 商品级打包费单价（分/件）；null/undefined = 沿用店铺配置金额 */
    packingFee: number | null | undefined;
    quantity: number;
}
export interface PackingFeeConfigInput {
    enabled?: boolean | null;
    mode?: string | null;
    amount?: number | null;
    cap?: number | null;
    label?: string | null;
}
/** 展示名归一：空串/未配置回默认「打包费」 */
export declare function resolvePackingFeeLabel(cfg: PackingFeeConfigInput | null | undefined): string;
/**
 * 打包费合计（分）。未开启/金额为 0 时返回 0。
 * 两端必须使用同一函数：C 端展示与后端 surcharge 金额不一致会导致顾客实付与页面不符。
 */
export declare function quotePackingFee(cfg: PackingFeeConfigInput | null | undefined, lines: PackingFeeLineInput[]): number;
