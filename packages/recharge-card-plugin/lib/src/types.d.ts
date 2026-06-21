export interface RechargeCardPluginOptions {
    /** Default expiry months for recharge cards (default: 12) */
    defaultExpiresMonths?: number;
}
export type RechargeCardState = 'unused' | 'used' | 'expired' | 'frozen';
