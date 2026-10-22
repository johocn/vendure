"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeituanDeliveryProvider = exports.MEITUAN_STATUS_MAP = void 0;
exports.mapMeituanStatus = mapMeituanStatus;
const core_1 = require("@vendure/core");
const meituan_http_adapter_1 = require("./meituan-http.adapter");
const meituan_signature_1 = require("./meituan-signature");
const constants_1 = require("./constants");
/** 美团配送状态码 → 统一状态（0/10 待接单、20 已接单、30/40 取货/配送中、50 完成、99 取消） */
exports.MEITUAN_STATUS_MAP = {
    0: 'pending',
    10: 'pending',
    20: 'accepted',
    30: 'pickup',
    40: 'pickup',
    50: 'delivered',
    99: 'cancelled',
};
function mapMeituanStatus(raw) {
    var _a;
    const n = Number(raw);
    return (_a = exports.MEITUAN_STATUS_MAP[n]) !== null && _a !== void 0 ? _a : 'exception';
}
class MeituanDeliveryProvider {
    constructor(config) {
        this.config = config;
        this.code = 'meituan';
        this.name = '美团配送';
        this.http = new meituan_http_adapter_1.MeituanHttpAdapter(config);
    }
    async quote(_ctx, req) {
        var _a, _b, _c, _d, _e;
        // 美团询价接口存在版本差异；统一走 create 前的预校验接口，失败时给不可用而非抛错
        try {
            const data = await this.http.post('/api/order/queryPrice', {
                shop_id: this.config.shopId,
                receiver_address: (_a = req.dropoff.address) !== null && _a !== void 0 ? _a : req.dropoff.name,
                receiver_latitude: req.dropoff.lat,
                receiver_longitude: req.dropoff.lng,
                goods_weight: (_b = req.weight) !== null && _b !== void 0 ? _b : 1,
            });
            return {
                fee: Number((_d = (_c = data === null || data === void 0 ? void 0 : data.price) !== null && _c !== void 0 ? _c : data === null || data === void 0 ? void 0 : data.delivery_fee) !== null && _d !== void 0 ? _d : 0),
                feeDetail: JSON.stringify(data !== null && data !== void 0 ? data : {}),
                etaMinutes: Number((_e = data === null || data === void 0 ? void 0 : data.estimate_time) !== null && _e !== void 0 ? _e : 30),
                available: true,
            };
        }
        catch (_f) {
            return { fee: 0, feeDetail: '', etaMinutes: 0, available: false };
        }
    }
    async createDelivery(_ctx, req) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const data = await this.http.post('/api/order/create', {
            shop_id: req.providerShopNo || this.config.shopId,
            delivery_id: `WM${req.orderId}-${Date.now()}`,
            receiver_name: req.dropoff.name,
            receiver_phone: (_a = req.dropoff.phone) !== null && _a !== void 0 ? _a : '',
            receiver_address: (_b = req.dropoff.address) !== null && _b !== void 0 ? _b : req.dropoff.name,
            receiver_latitude: req.dropoff.lat,
            receiver_longitude: req.dropoff.lng,
            sender_name: req.pickup.name,
            sender_phone: (_d = (_c = req.pickup.phone) !== null && _c !== void 0 ? _c : this.config.defaultCourierPhone) !== null && _d !== void 0 ? _d : '',
            sender_address: (_e = req.pickup.address) !== null && _e !== void 0 ? _e : req.pickup.name,
            sender_latitude: req.pickup.lat,
            sender_longitude: req.pickup.lng,
            goods_name: req.items.map(i => i.name).join('、').slice(0, 50) || '外卖餐品',
            goods_count: req.items.reduce((s, i) => s + i.quantity, 0),
            note: (_f = req.remark) !== null && _f !== void 0 ? _f : '',
            callback_url: (_h = (_g = req.callbackUrl) !== null && _g !== void 0 ? _g : this.config.callbackUrl) !== null && _h !== void 0 ? _h : '',
        });
        const thirdPartyNo = String((_k = (_j = data === null || data === void 0 ? void 0 : data.order_id) !== null && _j !== void 0 ? _j : data === null || data === void 0 ? void 0 : data.delivery_no) !== null && _k !== void 0 ? _k : '');
        if (!thirdPartyNo) {
            throw new Error('美团下单返回缺 order_id');
        }
        return {
            deliveryOrderNo: thirdPartyNo,
            thirdPartyNo,
            status: 'pending',
            fee: Number((_m = (_l = data === null || data === void 0 ? void 0 : data.delivery_fee) !== null && _l !== void 0 ? _l : data === null || data === void 0 ? void 0 : data.price) !== null && _m !== void 0 ? _m : 0),
            etaMinutes: Number((_o = data === null || data === void 0 ? void 0 : data.estimate_time) !== null && _o !== void 0 ? _o : 30),
        };
    }
    async cancelDelivery(_ctx, deliveryOrderNo, reason) {
        var _a;
        try {
            await this.http.post('/api/order/cancel', {
                shop_id: this.config.shopId,
                order_id: deliveryOrderNo,
                cancel_reason: reason !== null && reason !== void 0 ? reason : '商家取消',
            });
            return { success: true };
        }
        catch (e) {
            return { success: false, reason: (_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : String(e) };
        }
    }
    /** 美团回调字段兼容：order_id / status / courier_name / courier_phone / cancel_reason */
    parseWebhook(payload) {
        var _a, _b;
        const raw = (payload !== null && payload !== void 0 ? payload : {});
        let body = raw;
        if (typeof raw.body === 'string') {
            try {
                body = JSON.parse(raw.body);
            }
            catch (_c) {
                body = raw;
            }
        }
        else if (raw.body && typeof raw.body === 'object') {
            body = raw.body;
        }
        const deliveryOrderNo = String((_b = (_a = body.order_id) !== null && _a !== void 0 ? _a : body.delivery_no) !== null && _b !== void 0 ? _b : '');
        if (!deliveryOrderNo) {
            throw new Error('美团回调报文缺 order_id');
        }
        return {
            deliveryOrderNo,
            status: mapMeituanStatus(body.status),
            courierName: body.courier_name ? String(body.courier_name) : undefined,
            courierPhone: body.courier_phone ? String(body.courier_phone) : undefined,
            reason: body.cancel_reason ? String(body.cancel_reason) : undefined,
        };
    }
    verifyCallback(payload) {
        var _a;
        // open 模式签名含请求 URL，未配置 callbackUrl 时无法重算：放行并告警，避免整条链路静默丢回调
        if (this.config.signMode === 'open' && !this.config.callbackUrl) {
            core_1.Logger.warn('美团 open 模式未配置 callbackUrl，跳过回调验签', constants_1.loggerCtx);
            return true;
        }
        const raw = (payload !== null && payload !== void 0 ? payload : {});
        return (0, meituan_signature_1.verifyMeituanCallback)(raw, this.config.appSecret, this.config.signMode, (_a = this.config.callbackUrl) !== null && _a !== void 0 ? _a : '');
    }
}
exports.MeituanDeliveryProvider = MeituanDeliveryProvider;
//# sourceMappingURL=meituan-delivery-provider.js.map