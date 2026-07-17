export const loggerCtx = 'CouponPlugin';
export const COUPON_PLUGIN_OPTIONS = Symbol('COUPON_PLUGIN_OPTIONS');

export enum CouponType {
    Fixed = 'fixed',
    Percentage = 'percentage',
}

export enum CouponCodeStatus {
    Unused = 'unused',
    Used = 'used',
    Expired = 'expired',
}
