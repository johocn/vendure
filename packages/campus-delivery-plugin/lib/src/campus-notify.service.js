"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusNotifyService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_config_service_1 = require("./campus-config.service");
/** 触点 → 配置实体模板字段（值 = SSO msg-template 的 templateCode；未配置 = 该节点静默跳过） */
const TEMPLATE_FIELD = {
    orderAccepted: 'notifyTemplateAccepted',
    riderAssigned: 'notifyTemplateRiderAssigned',
    cookingDone: 'notifyTemplateCookingDone',
    orderDelivered: 'notifyTemplateDelivered',
    exceptionHandled: 'notifyTemplateExceptionHandled',
    orderPlaced: 'notifyTemplateOrderPlaced',
    paymentPending: 'notifyTemplatePaymentPending',
    orderCancelled: 'notifyTemplateCancelled',
    afterSales: 'notifyTemplateAfterSales',
};
/** 售后类型短语（微信 phrase 占位符 ≤5 字符） */
const AFTER_SALE_TYPE = {
    exceptionHandled: '异常已处理',
    afterSales: '进度更新',
};
// F7 最小补发：进程内重试 + 退避（首推失败不再只留一条日志）。
// 不落库（1G 小机避免加表/迁移）；dedupe_key 固定为 campus:{event}:{orderId}，
// SSO msg-job 侧按 key 幂等 → 超时重发不会产生重复消息。
const SEND_ATTEMPTS = 3;
const SEND_BACKOFF_MS = [2000, 8000];
const SEND_TIMEOUT_MS = 10000;
/**
 * 用户侧节点通知（公众号模板消息，经 zhao-sso 服务间 API 发送）。
 * 链路：customer.customFields.ssoId（SSO 用户 id）→ POST {SSO_NOTIFY_BASE_URL}/v1/msg/template-send
 * （app_code+app_secret bcrypt 鉴权）→ SSO msg-job 落库 → 按绑定表解析 openid → 微信模板消息。
 * 环境变量：SSO_NOTIFY_BASE_URL（如 https://h.joho.cn/api/zhao-sso）、SSO_NOTIFY_APP_CODE、SSO_NOTIFY_APP_SECRET。
 * 设计约束：fire-and-forget——模板未配置/用户无 ssoId/SSO 未配置/发送失败一律只记日志，绝不阻塞、绝不抛出到业务主流程。
 * 微信模板占位符映射由 SSO msg-template 的 wxTemplateFields 配置（name=微信占位符，key=本服务 params 键）。
 */
let CampusNotifyService = class CampusNotifyService {
    constructor(connection, config) {
        this.connection = connection;
        this.config = config;
    }
    /** 发送节点通知（异步不等待，不抛错）。text：动态文案覆盖 status（如异常处置结果，超 20 字符自动截断）；h5BaseUrl：配置后消息带 url 跳 H5 订单详情落地页 */
    user(ctx, orderId, event, text, h5BaseUrl) {
        void (async () => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
            try {
                const baseUrl = process.env.SSO_NOTIFY_BASE_URL;
                const appCode = process.env.SSO_NOTIFY_APP_CODE;
                const appSecret = process.env.SSO_NOTIFY_APP_SECRET;
                if (!baseUrl || !appCode || !appSecret) {
                    core_1.Logger.debug('SSO notify env not configured (SSO_NOTIFY_BASE_URL/APP_CODE/APP_SECRET), skip', 'CampusNotify');
                    return;
                }
                const cfg = await this.config.getConfig(ctx);
                const templateCode = cfg[TEMPLATE_FIELD[event]];
                if (!templateCode) {
                    core_1.Logger.debug(`channel ${ctx.channelId} has no ${TEMPLATE_FIELD[event]}, skip user notify`, 'CampusNotify');
                    return;
                }
                const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
                    where: { id: orderId },
                    relations: ['customer', 'lines', 'lines.productVariant'],
                });
                const ssoId = (_b = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.ssoId;
                if (!order || !ssoId) {
                    core_1.Logger.debug(`order ${orderId} customer has no ssoId, skip user notify (${event})`, 'CampusNotify');
                    return;
                }
                // 微信模板字段必填：按事件分型组装 params（与 sso_msg_templates.wx_template_fields 的 key 对应）
                const lines = (_c = order.lines) !== null && _c !== void 0 ? _c : [];
                const firstName = (_f = (_e = (_d = lines[0]) === null || _d === void 0 ? void 0 : _d.productVariant) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : '商品';
                const itemName = (lines.length > 1 ? `${firstName} 等${lines.length}件` : firstName).slice(0, 20);
                const amount = (((_g = order.totalWithTax) !== null && _g !== void 0 ? _g : 0) / 100).toFixed(2);
                const params = event === 'orderCancelled'
                    ? { orderCode: order.code, itemName, refundAmount: amount }
                    : event === 'afterSales' || event === 'exceptionHandled'
                        ? {
                            orderCode: order.code,
                            itemName,
                            afterSaleType: ((_h = text !== null && text !== void 0 ? text : AFTER_SALE_TYPE[event]) !== null && _h !== void 0 ? _h : '进度更新').slice(0, 5),
                        }
                        : { orderCode: order.code, itemName, amount, payMethod: '在线支付' };
                const link = h5BaseUrl
                    ? `${h5BaseUrl.replace(/\/$/, '')}/#/pkg-order/pages/order-detail?code=${order.code}`
                    : undefined;
                const payload = JSON.stringify({
                    app_code: appCode,
                    app_secret: appSecret,
                    sso_user_id: Number(ssoId),
                    template_code: templateCode,
                    params,
                    link,
                    scene: `campus:${event}`,
                    dedupe_key: `campus:${event}:${orderId}`,
                });
                // 发送 + 退避重试：2s / 8s，单次超时 10s；dedupe_key 幂等，重发不产生重复消息
                let lastErr;
                for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
                    try {
                        if (attempt > 1) {
                            await new Promise(r => setTimeout(r, SEND_BACKOFF_MS[attempt - 2]));
                        }
                        const body = await this.sendOnce(baseUrl, payload);
                        core_1.Logger.info(`user notify ${event} sent for ${order.code} (job=${(_o = ((_l = (_k = (_j = body === null || body === void 0 ? void 0 : body.data) === null || _j === void 0 ? void 0 : _j.job) === null || _k === void 0 ? void 0 : _k.id) !== null && _l !== void 0 ? _l : (_m = body === null || body === void 0 ? void 0 : body.data) === null || _m === void 0 ? void 0 : _m.id)) !== null && _o !== void 0 ? _o : '?'} status=${(_t = (_r = (_q = (_p = body === null || body === void 0 ? void 0 : body.data) === null || _p === void 0 ? void 0 : _p.job) === null || _q === void 0 ? void 0 : _q.status) !== null && _r !== void 0 ? _r : (_s = body === null || body === void 0 ? void 0 : body.data) === null || _s === void 0 ? void 0 : _s.status) !== null && _t !== void 0 ? _t : '?'})`, 'CampusNotify');
                        return;
                    }
                    catch (e) {
                        lastErr = e;
                        core_1.Logger.warn(`user notify ${event} for order ${orderId} attempt ${attempt}/${SEND_ATTEMPTS} failed: ${(_u = e === null || e === void 0 ? void 0 : e.message) !== null && _u !== void 0 ? _u : e}`, 'CampusNotify');
                    }
                }
                core_1.Logger.error(`user notify ${event} for order ${orderId} dropped after ${SEND_ATTEMPTS} attempts: ${lastErr instanceof Error ? lastErr.message : lastErr}`, 'CampusNotify');
            }
            catch (e) {
                core_1.Logger.warn(`user notify ${event} for order ${orderId} failed: ${(_v = e === null || e === void 0 ? void 0 : e.message) !== null && _v !== void 0 ? _v : e}`, 'CampusNotify');
            }
        })();
    }
    /** 单次发送（10s 超时）；非 2xx 或响应体异常抛错由上层重试 */
    async sendOnce(baseUrl, payload) {
        var _a, _b;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/msg/template-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        const body = (await res.json().catch(() => null));
        if (!res.ok) {
            throw new Error(`SSO api ${res.status}: ${(_b = (_a = body === null || body === void 0 ? void 0 : body.error) !== null && _a !== void 0 ? _a : body === null || body === void 0 ? void 0 : body.error_description) !== null && _b !== void 0 ? _b : 'unknown'}`);
        }
        return body;
    }
};
exports.CampusNotifyService = CampusNotifyService;
exports.CampusNotifyService = CampusNotifyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        campus_config_service_1.CampusConfigService])
], CampusNotifyService);
//# sourceMappingURL=campus-notify.service.js.map