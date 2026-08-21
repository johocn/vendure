export interface SettlementPluginOptions {
    /** 平台默认佣金率（%），商户账户未配置时使用。默认 0。 */
    defaultCommissionRate?: number;
}
export interface ListOptions {
    skip?: number;
    take?: number;
}
/** 结算汇总（时间窗）。 */
export interface SettlementSummary {
    goodsAmountWithTax: number;
    shippingAmountWithTax: number;
    commissionAmount: number;
    netAmountWithTax: number;
}
