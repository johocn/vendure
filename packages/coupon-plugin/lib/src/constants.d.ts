export declare const loggerCtx = "CouponPlugin";
export declare const COUPON_PLUGIN_OPTIONS: unique symbol;
/**
 * 属店权限隔离：店主管理员操作「非本店」发行的券时抛出的 ForbiddenError 消息。
 * 前端据此提示「无权操作其他店铺的券」。
 */
export declare const COUPON_NOT_OWNED = "COUPON_NOT_OWNED: \u4E0D\u80FD\u64CD\u4F5C\u975E\u672C\u5E97\u53D1\u884C\u7684\u4F18\u60E0\u5238";
