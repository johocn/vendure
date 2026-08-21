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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatNotifierProvider = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const constants_2 = require("./constants");
/**
 * 微信模板消息：调用 strapi zhao-sso admin msg-jobs/anonymous 接口。
 * 契约对齐 strapi/scripts/accept-msg-center.cjs：
 *   POST {base}/api/zhao-sso/v1/admin/msg-jobs/anonymous
 *   body { userId, scene, templateCode, params, link }
 * 未配置基址/token/开关时直接返回 false（仅站内信，不报错）。
 */
let WechatNotifierProvider = class WechatNotifierProvider {
    constructor(options) {
        this.options = options;
    }
    async send(frame) {
        var _a, _b;
        const { strapiBaseUrl, strapiAdminToken, wechatEnabled, templateSceneMap, httpTimeoutMs } = this.options;
        if (!wechatEnabled || !strapiBaseUrl || !strapiAdminToken) {
            return false;
        }
        const templateCode = (_a = frame.templateCode) !== null && _a !== void 0 ? _a : templateSceneMap === null || templateSceneMap === void 0 ? void 0 : templateSceneMap[frame.scene];
        if (!templateCode || frame.recipientType !== 'customer' || !frame.customerId) {
            return false;
        }
        try {
            const full = `${strapiBaseUrl.replace(/\/$/, '')}/api/zhao-sso/v1/admin/msg-jobs/anonymous`;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), httpTimeoutMs !== null && httpTimeoutMs !== void 0 ? httpTimeoutMs : 5000);
            const res = await fetch(full, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${strapiAdminToken}` },
                signal: ctrl.signal,
                body: JSON.stringify(Object.assign({ userId: Number(frame.customerId), scene: frame.scene, templateCode, params: (_b = frame.templateParams) !== null && _b !== void 0 ? _b : {} }, (frame.link ? { link: frame.link } : {}))),
            });
            clearTimeout(t);
            if (!res.ok) {
                core_1.Logger.warn(`wechat send http ${res.status} scene=${frame.scene}`, constants_2.loggerCtx);
                return false;
            }
            core_1.Logger.verbose(`wechat send ok scene=${frame.scene}`, constants_2.loggerCtx);
            return true;
        }
        catch (e) {
            core_1.Logger.warn(`wechat send failed: ${e === null || e === void 0 ? void 0 : e.message}`, constants_2.loggerCtx);
            return false;
        }
    }
};
exports.WechatNotifierProvider = WechatNotifierProvider;
exports.WechatNotifierProvider = WechatNotifierProvider = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.NOTIFICATION_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], WechatNotifierProvider);
//# sourceMappingURL=wechat-notifier-provider.js.map