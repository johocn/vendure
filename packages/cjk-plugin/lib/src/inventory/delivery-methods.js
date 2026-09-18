"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.locationSupports = locationSupports;
exports.filterLocationsByDelivery = filterLocationsByDelivery;
/** 网点是否支持某配送方式。deliveryMethods 空/未配置 = 兼容旧数据，两者都支持。 */
function locationSupports(loc, method) {
    var _a, _b, _c;
    const methods = (_c = (_b = (_a = loc === null || loc === void 0 ? void 0 : loc.customFields) === null || _a === void 0 ? void 0 : _a.deliveryMethods) === null || _b === void 0 ? void 0 : _b.filter((m) => !!m)) !== null && _c !== void 0 ? _c : [];
    return methods.length === 0 || methods.includes(method);
}
/** 按请求配送方式过滤网点候选。请求为空 = 不做过滤（全放行）。 */
function filterLocationsByDelivery(locations, requested) {
    if (!requested.length)
        return locations;
    return locations.filter((l) => requested.some((m) => locationSupports(l, m)));
}
//# sourceMappingURL=delivery-methods.js.map