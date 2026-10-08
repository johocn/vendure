"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JianghuRiskService = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * 江湖风控：纯函数 + 轻状态校验（不依赖 DB）。
 * - 信用分 <60 或面壁期 → 冻结接取
 * - 暗号 60s 一次性、6 位
 * - LBS 围栏 haversine 半径判定
 */
class JianghuRiskService {
    /** 6 位数字一次性暗号 */
    genCode() {
        let s = '';
        for (let i = 0; i < 6; i++)
            s += Math.floor(Math.random() * 10);
        return s;
    }
    /** haversine 距离（米），无坐标任务直接放行 */
    withinFence(lat, lng, tLat, tLng, meters) {
        if (!tLat || !tLng)
            return true;
        const R = 6371000;
        const dLat = ((lat - tLat) * Math.PI) / 180;
        const dLng = ((lng - tLng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat * Math.PI) / 180) * Math.cos((tLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const d = 2 * R * Math.asin(Math.sqrt(a));
        return d <= meters;
    }
    /** haversine 距离（公里）；缺坐标返回 null */
    distanceKm(lat, lng, tLat, tLng) {
        if (lat == null || lng == null || !tLat || !tLng)
            return null;
        const R = 6371;
        const dLat = ((lat - tLat) * Math.PI) / 180;
        const dLng = ((lng - tLng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat * Math.PI) / 180) * Math.cos((tLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }
    assertNotFrozen(profile, customer) {
        var _a, _b, _c;
        const credit = (_a = profile.credit) !== null && _a !== void 0 ? _a : ((_c = (_b = customer === null || customer === void 0 ? void 0 : customer.customFields) === null || _b === void 0 ? void 0 : _b.riderCredit) !== null && _c !== void 0 ? _c : 100);
        if (credit < constants_1.CREDIT_LIMIT) {
            throw new core_1.UserInputError('信用分低于 60，江湖任务已冻结');
        }
        if (profile.frozenUntil && new Date(profile.frozenUntil).getTime() > Date.now()) {
            throw new core_1.UserInputError('面壁中，暂不可接取江湖任务');
        }
    }
}
exports.JianghuRiskService = JianghuRiskService;
//# sourceMappingURL=jianghu-risk.service.js.map