"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponCodeStatus = exports.CouponType = exports.COUPON_PLUGIN_OPTIONS = exports.loggerCtx = void 0;
exports.loggerCtx = 'CouponPlugin';
exports.COUPON_PLUGIN_OPTIONS = Symbol('COUPON_PLUGIN_OPTIONS');
var CouponType;
(function (CouponType) {
    CouponType["Fixed"] = "fixed";
    CouponType["Percentage"] = "percentage";
})(CouponType || (exports.CouponType = CouponType = {}));
var CouponCodeStatus;
(function (CouponCodeStatus) {
    CouponCodeStatus["Unused"] = "unused";
    CouponCodeStatus["Used"] = "used";
    CouponCodeStatus["Expired"] = "expired";
})(CouponCodeStatus || (exports.CouponCodeStatus = CouponCodeStatus = {}));
//# sourceMappingURL=constants.js.map