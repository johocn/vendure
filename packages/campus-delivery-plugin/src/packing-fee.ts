/**
 * 打包费/餐盒费（P1-1）报价：纯函数，C 端前端展示与后端结算落账共用同一口径。
 * - perItem（默认）：Σ(商品级覆盖单价 ?? 店铺单价) × 件数
 * - perOrder：每单固定金额（忽略商品级覆盖）
 * - cap 非空时单笔封顶
 */

/** 结算 surcharge 的幂等标记：按 sku 精确识别本插件写入的那一条，避免误删促销/其它 surcharge */
export const PACKING_FEE_SKU = 'campus-packing-fee';

/** 计费方式白名单 */
export const PACKING_FEE_MODES = ['perItem', 'perOrder'] as const;
export type PackingFeeMode = (typeof PACKING_FEE_MODES)[number];

/** 计费方式归一：null/非法值回 'perItem'（存量行与脏配置兜底） */
export function normalizePackingFeeMode(v: unknown): PackingFeeMode {
    return PACKING_FEE_MODES.includes(v as PackingFeeMode) ? (v as PackingFeeMode) : 'perItem';
}

/** 默认展示名（店铺未自定义时） */
export const DEFAULT_PACKING_FEE_LABEL = '打包费';

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
export function resolvePackingFeeLabel(cfg: PackingFeeConfigInput | null | undefined): string {
    const v = String(cfg?.label ?? '').trim();
    return v || DEFAULT_PACKING_FEE_LABEL;
}

/** 非负整数归一（脏值/NaN 归 0） */
function toFen(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n);
}

/**
 * 打包费合计（分）。未开启/金额为 0 时返回 0。
 * 两端必须使用同一函数：C 端展示与后端 surcharge 金额不一致会导致顾客实付与页面不符。
 */
export function quotePackingFee(
    cfg: PackingFeeConfigInput | null | undefined,
    lines: PackingFeeLineInput[],
): number {
    if (!cfg?.enabled) return 0;
    const amount = toFen(cfg.amount);
    const mode: PackingFeeMode = cfg.mode === 'perOrder' ? 'perOrder' : 'perItem';
    let fee = 0;
    if (mode === 'perOrder') {
        fee = amount;
    } else {
        for (const line of lines ?? []) {
            const qty = toFen(line?.quantity);
            if (!qty) continue;
            const override = line?.packingFee == null ? null : toFen(line.packingFee);
            // 商品级显式配置 0 表示「该商品不收打包费」，与「未配置（沿用店铺单价）」区分
            const unit = line?.packingFee == null ? amount : (override as number);
            fee += unit * qty;
        }
    }
    const cap = cfg.cap == null ? null : toFen(cfg.cap);
    if (cap != null && cap > 0) fee = Math.min(fee, cap);
    return fee;
}
