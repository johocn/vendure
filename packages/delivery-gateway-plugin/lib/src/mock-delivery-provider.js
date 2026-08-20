"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDeliveryProvider = void 0;
/** 模拟配送商：本地闭环验证用，接单/取货/送达由后台模拟接口触发 */
class MockDeliveryProvider {
    constructor() {
        this.code = 'mock';
        this.name = '模拟配送商';
    }
    async quote(_ctx, req) {
        const distance = this.approxKm(req.pickup, req.dropoff);
        const fee = 500 + Math.round(distance * 150); // 起步 5 元 + 1.5 元/km
        return { fee, feeDetail: `起步5元+${distance.toFixed(1)}km*1.5元`, etaMinutes: 30, available: true };
    }
    async createDelivery(_ctx, req) {
        return {
            deliveryOrderNo: `TDS${Date.now()}`,
            thirdPartyNo: `MOCK${Date.now()}`,
            status: 'pending',
            fee: (await this.quote(_ctx, req)).fee,
        };
    }
    async cancelDelivery(_ctx, _deliveryOrderNo, reason) {
        return { success: true, reason };
    }
    parseWebhook(payload) {
        return {
            deliveryOrderNo: payload === null || payload === void 0 ? void 0 : payload.deliveryOrderNo,
            status: payload === null || payload === void 0 ? void 0 : payload.status,
            courierName: payload === null || payload === void 0 ? void 0 : payload.courierName,
            courierPhone: payload === null || payload === void 0 ? void 0 : payload.courierPhone,
            deliveredAt: (payload === null || payload === void 0 ? void 0 : payload.deliveredAt) ? new Date(payload.deliveredAt) : undefined,
            reason: payload === null || payload === void 0 ? void 0 : payload.reason,
        };
    }
    approxKm(a, b) {
        const R = 6371;
        const dLat = ((b.lat - a.lat) * Math.PI) / 180;
        const dLng = ((b.lng - a.lng) * Math.PI) / 180;
        const s = Math.sin(dLat / 2) ** 2 +
            Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(s));
    }
}
exports.MockDeliveryProvider = MockDeliveryProvider;
//# sourceMappingURL=mock-delivery-provider.js.map