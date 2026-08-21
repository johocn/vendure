export declare const VOUCHER_PLUGIN_OPTIONS: unique symbol;
export interface VoucherPluginOptions {
    /** 兜底有效期（天），生成券而未显式给定 effectiveDays 时使用。 */
    defaultEffectiveDays?: number;
}
