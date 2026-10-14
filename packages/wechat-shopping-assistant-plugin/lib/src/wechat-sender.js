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
exports.WechatSender = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const wechat_auth_plugin_1 = require("@vendure/wechat-auth-plugin");
const constants_1 = require("./constants");
/**
 * 微信出站消息封装：news 失败自动降级 text 由调用方编排。
 * outboundMode='echo' 时不调微信 API，仅打印 payload（本地冒烟用）。
 */
let WechatSender = class WechatSender {
    constructor(wechatAuth) {
        this.wechatAuth = wechatAuth;
        this.echoMode = false;
    }
    /** 由插件初始化时按 options.outboundMode 注入 */
    setEchoMode(echo) {
        this.echoMode = echo;
    }
    async send(message, credentials) {
        if (this.echoMode) {
            core_1.Logger.info(`[echo] outbound message: ${JSON.stringify(message)}`, constants_1.loggerCtx);
            return;
        }
        // cred 仅在渠道覆盖了独立 appId/appSecret 时生效（wechat-auth-plugin 内部比对主 appId）
        const cred = credentials.appId && credentials.appSecret ? credentials : undefined;
        if (message.kind === 'text') {
            await this.wechatAuth.sendCustomText(message.touser, message.content, cred);
        }
        else {
            await this.wechatAuth.sendCustomNews(message.touser, message.articles, cred);
        }
    }
    /** news 发送失败（45166/40007 等）时自动降级纯文本 */
    async sendOrFallback(message, fallbackText, credentials) {
        try {
            await this.send(message, credentials);
        }
        catch (e) {
            core_1.Logger.warn(`Outbound ${message.kind} failed, fallback to text: ${String(e)}`, constants_1.loggerCtx);
            await this.send({ kind: 'text', touser: message.touser, content: fallbackText }, credentials);
        }
    }
};
exports.WechatSender = WechatSender;
exports.WechatSender = WechatSender = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [wechat_auth_plugin_1.WechatAuthService])
], WechatSender);
//# sourceMappingURL=wechat-sender.js.map