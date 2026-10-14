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
exports.CredentialService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
/**
 * 渠道凭证解析：优先渠道 authConfig.wechat 覆盖（appId/appSecret），
 * 未配置则回退插件级凭证（空 appId → 主公众号）。
 */
let CredentialService = class CredentialService {
    constructor(channelService) {
        this.channelService = channelService;
    }
    async resolveForChannel(channelToken, fallback) {
        try {
            const ctx = core_1.RequestContext.empty();
            const channel = await this.channelService.findOne(ctx, channelToken);
            if (!channel)
                return fallback;
            // 对齐 wechat-message.controller 的做法：以带 channel 的伪 ctx 读取 authConfig 覆盖
            const override = (0, cjk_plugin_1.getAuthOverride)({ channel }, 'wechat');
            if ((override === null || override === void 0 ? void 0 : override.appId) && (override === null || override === void 0 ? void 0 : override.appSecret)) {
                return { appId: override.appId, appSecret: override.appSecret };
            }
        }
        catch (_a) {
            // 渠道/凭证解析失败按插件级凭证发送
        }
        return fallback;
    }
};
exports.CredentialService = CredentialService;
exports.CredentialService = CredentialService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], CredentialService);
//# sourceMappingURL=credential.service.js.map