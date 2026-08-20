"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DadaDeliveryProvider = exports.DADA_STATUS_MAP = void 0;
const core_1 = require("@vendure/core");
const dada_signature_1 = require("./dada-signature");
const dada_http_adapter_1 = require("./dada-http.adapter");
const constants_1 = require("./constants");
/** 达达订单状态码 → 本地 DeliveryStatus（单一事实源，spec 复用） */
exports.DADA_STATUS_MAP = {
    1: 'pending', // 待接单
    2: 'accepted', // 已接单
    3: 'pickup', // 取货中
    4: 'pickup', // 配送中
    5: 'delivered', // 已完成
    7: 'cancelled', // 已过期
    10: 'cancelled', // 已取消
    1000: 'exception', // 异常/创建失败
};
const ENV_BASE_URL = {
    sandbox: 'https://newopen.qa.imdada.cn',
    production: 'https://newopen.imdada.cn',
};
/** 达达同城配送 Provider：契约层按官方文档固化，无凭据也可验证入站全链路 */
class DadaDeliveryProvider {
    constructor(config, http) {
        this.config = config;
        this.code = 'dada';
        this.name = '达达同城配送';
        this.http = http !== null && http !== void 0 ? http : new dada_http_adapter_1.FetchDadaHttpAdapter(ENV_BASE_URL[config.environment]);
    }
    /** 校验达达回调报文签名（用本 Provider 的 appSecret） */
    verifyCallback(payload) {
        return (0, dada_signature_1.verifyCallbackSignature)(payload, this.config.appSecret);
    }
    async quote(_ctx, req) {
        var _a, _b, _c, _d, _e, _f;
        try {
            const body = {
                shop_no: this.config.shopNo,
                origin_id: `Q${Date.now()}`,
                cargo_type: 1,
                cargo_weight: (_a = req.weight) !== null && _a !== void 0 ? _a : this.estimateWeight(req.items),
                receiver_lat: req.dropoff.lat,
                receiver_lng: req.dropoff.lng,
            };
            const res = await this.request('/api/order/queryDeliverFee', body);
            const result = ((_b = res === null || res === void 0 ? void 0 : res.result) !== null && _b !== void 0 ? _b : {});
            const fee = Number((_c = result.fee) !== null && _c !== void 0 ? _c : 0);
            return {
                fee,
                feeDetail: `达达计价 distance=${String((_d = result.distance) !== null && _d !== void 0 ? _d : 0)}m`,
                etaMinutes: Math.round(Number((_e = result.delivery_latency) !== null && _e !== void 0 ? _e : 0) / 60),
                available: fee > 0,
            };
        }
        catch (e) {
            core_1.Logger.warn(`达达计价失败: ${(_f = e === null || e === void 0 ? void 0 : e.message) !== null && _f !== void 0 ? _f : e}`, constants_1.loggerCtx);
            return { fee: 0, feeDetail: '达达计价失败', etaMinutes: 0, available: false };
        }
    }
    async createDelivery(_ctx, req) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const originId = `TDD${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const body = {
            shop_no: this.config.shopNo,
            origin_id: originId,
            cargo_price: 0, // 骨架阶段占位：按需结合订单金额
            is_prepay: 0,
            receiver_name: req.dropoff.name,
            receiver_address: (_a = req.dropoff.address) !== null && _a !== void 0 ? _a : req.dropoff.name,
            receiver_lat: req.dropoff.lat,
            receiver_lng: req.dropoff.lng,
            receiver_phone: (_b = req.dropoff.phone) !== null && _b !== void 0 ? _b : '',
            cargo_weight: (_c = req.weight) !== null && _c !== void 0 ? _c : this.estimateWeight(req.items),
            callback: this.config.callbackUrl,
            cargo_num: req.items.reduce((s, i) => s + i.quantity, 0),
            info: (_d = req.remark) !== null && _d !== void 0 ? _d : '',
        };
        const res = await this.request('/api/order/addOrder', body);
        if ((res === null || res === void 0 ? void 0 : res.status) !== 'success') {
            throw new Error(`达达下单失败: ${JSON.stringify((_e = res === null || res === void 0 ? void 0 : res.result) !== null && _e !== void 0 ? _e : res)}`);
        }
        const result = ((_f = res.result) !== null && _f !== void 0 ? _f : {});
        const deliveryNo = String((_g = result.deliveryNo) !== null && _g !== void 0 ? _g : '');
        if (!deliveryNo) {
            throw new Error('达达下单返回缺 deliveryNo');
        }
        return {
            deliveryOrderNo: originId,
            thirdPartyNo: deliveryNo,
            status: 'pending',
            fee: Number((_h = result.fee) !== null && _h !== void 0 ? _h : 0),
        };
    }
    async cancelDelivery(_ctx, deliveryOrderNo, reason) {
        var _a, _b, _c;
        try {
            const body = {
                order_id: deliveryOrderNo, // 达达单号（= DeliveryOrder.thirdPartyNo）
                cancel_reason_id: 1,
                cancel_reason: reason !== null && reason !== void 0 ? reason : '',
            };
            const res = await this.request('/api/order/formalCancel', body);
            if ((res === null || res === void 0 ? void 0 : res.status) !== 'success') {
                return { success: false, reason: JSON.stringify((_a = res === null || res === void 0 ? void 0 : res.result) !== null && _a !== void 0 ? _a : res) };
            }
            return { success: true, reason };
        }
        catch (e) {
            core_1.Logger.warn(`达达取消失败 ${deliveryOrderNo}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, constants_1.loggerCtx);
            return { success: false, reason: (_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : String(e) };
        }
    }
    parseWebhook(payload) {
        var _a, _b, _c, _d, _e;
        // 达达回调业务字段位于 body(JSON 字符串)；兼容平铺 top-level
        let business = payload;
        if (payload && typeof payload.body === 'string') {
            try {
                business = JSON.parse(payload.body);
            }
            catch (_f) {
                business = payload;
            }
        }
        const statusCode = Number((_a = business === null || business === void 0 ? void 0 : business.order_status) !== null && _a !== void 0 ? _a : -1);
        const status = exports.DADA_STATUS_MAP[statusCode];
        if (!status) {
            throw new Error(`未识别的达达状态码: ${statusCode}`);
        }
        // 优先 order_id（本地第三方单号=code）；缺失时兜底 client_id（达达单号=thirdPartyNo）
        const deliveryOrderNo = String((_c = (_b = business === null || business === void 0 ? void 0 : business.order_id) !== null && _b !== void 0 ? _b : business === null || business === void 0 ? void 0 : business.client_id) !== null && _c !== void 0 ? _c : '');
        if (!deliveryOrderNo) {
            throw new Error('达达回调报文缺 order_id/client_id');
        }
        return {
            deliveryOrderNo,
            status,
            courierName: business === null || business === void 0 ? void 0 : business.transporter_name,
            courierPhone: business === null || business === void 0 ? void 0 : business.transporter_phone,
            deliveredAt: status === 'delivered' ? new Date() : undefined,
            reason: (_e = (_d = business === null || business === void 0 ? void 0 : business.cancel_reason) !== null && _d !== void 0 ? _d : business === null || business === void 0 ? void 0 : business.reason) !== null && _e !== void 0 ? _e : business === null || business === void 0 ? void 0 : business.msg,
        };
    }
    async request(path, body) {
        const params = (0, dada_signature_1.buildSignedParams)(this.config.appKey, this.config.appSecret, body, {
            sourceId: this.config.sourceId,
        });
        return this.http.post(path, params);
    }
    estimateWeight(items) {
        const kg = items.reduce((s, i) => s + i.quantity, 0) * 0.5;
        return Math.max(1, Math.ceil(kg));
    }
}
exports.DadaDeliveryProvider = DadaDeliveryProvider;
//# sourceMappingURL=dada-delivery-provider.js.map