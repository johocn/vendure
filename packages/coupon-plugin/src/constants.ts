export const loggerCtx = 'CouponPlugin';
export const COUPON_PLUGIN_OPTIONS = Symbol('COUPON_PLUGIN_OPTIONS');

/**
 * 属店权限隔离：店主管理员操作「非本店」发行的券时抛出的 ForbiddenError 消息。
 * 前端据此提示「无权操作其他店铺的券」。
 */
export const COUPON_NOT_OWNED = 'COUPON_NOT_OWNED: 不能操作非本店发行的优惠券';