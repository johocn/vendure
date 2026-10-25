"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusSmsService = void 0;
const common_1 = require("@nestjs/common");
/**
 * 短信兜底适配器（通知第 2 通道）。
 * 只在环境变量齐全时启用：SMS_GATEWAY_URL / SMS_GATEWAY_KEY；未配置即静默 no-op，
 * 不伪造发送成功、不阻塞业务主流程（公众号模板消息仍是第 1 通道）。
 * 网关契约：POST {SMS_GATEWAY_URL}，Header Authorization: Bearer {key}，
 * body { phone, content, signName }；2xx 视为发送成功。
 */
let CampusSmsService = class CampusSmsService {
    constructor() {
        this.loggerCtx = 'CampusSms';
        this.timeoutMs = 8000;
    }
    get configured() {
        return Boolean(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_KEY);
    }
    async send(phone, content) {
        var _a, _b;
        if (!this.configured)
            return false;
        const normalized = String(phone !== null && phone !== void 0 ? phone : '').replace(/[^\d+]/g, '');
        if (!normalized)
            return false;
        try {
            const res = await fetch(String(process.env.SMS_GATEWAY_URL), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.SMS_GATEWAY_KEY}`,
                },
                body: JSON.stringify({
                    phone: normalized,
                    content,
                    signName: (_a = process.env.SMS_SIGN_NAME) !== null && _a !== void 0 ? _a : '',
                }),
                signal: AbortSignal.timeout(this.timeoutMs),
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                common_1.Logger.warn(`sms gateway ${res.status}: ${body.slice(0, 200)}`, this.loggerCtx);
                return false;
            }
            return true;
        }
        catch (e) {
            common_1.Logger.warn(`sms send failed: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, this.loggerCtx);
            return false;
        }
    }
};
exports.CampusSmsService = CampusSmsService;
exports.CampusSmsService = CampusSmsService = __decorate([
    (0, common_1.Injectable)()
], CampusSmsService);
//# sourceMappingURL=campus-sms.service.js.map