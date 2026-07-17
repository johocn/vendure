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
exports.WxacodeService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const wechat_auth_service_1 = require("./wechat-auth.service");
const constants_1 = require("./constants");
let WxacodeService = class WxacodeService {
    constructor(wechatAuthService, options) {
        this.wechatAuthService = wechatAuthService;
        this.options = options;
        this.userCallCount = new Map();
        this.MAX_CALLS_PER_MINUTE = 10;
    }
    async generateWxacode(ctx, args) {
        // 1. 鉴权
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        // 2. 参数校验
        if (args.scene.length > 32) {
            throw new core_1.UserInputError('scene 参数不能超过 32 字符');
        }
        // 3. 频次限制
        this.checkRateLimit(String(ctx.activeUserId));
        // 4. 获取租户级小程序凭证（getAuthOverride 是同步函数）
        const override = (0, cjk_plugin_1.getAuthOverride)(ctx, 'wechat');
        const appId = (override === null || override === void 0 ? void 0 : override.miniProgramAppId) || this.options.miniProgramAppId;
        const appSecret = (override === null || override === void 0 ? void 0 : override.miniProgramAppSecret) || this.options.miniProgramAppSecret;
        if (!appId || !appSecret) {
            throw new Error('小程序凭证未配置');
        }
        // 5. 获取 access_token
        const accessToken = await this.wechatAuthService.getMiniProgramAccessToken(appId, appSecret);
        // 6. 调用微信 getwxacodeunlimit 接口
        const response = await fetch('https://api.weixin.qq.com/wxa/getwxacodeunlimit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                access_token: accessToken,
                scene: args.scene,
                page: args.path,
                width: args.width || 430,
                env_version: 'release',
                check_path: false,
            }),
        });
        // 7. 处理响应
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('image/')) {
            const buffer = Buffer.from(await response.arrayBuffer());
            return {
                contentType,
                base64: buffer.toString('base64'),
            };
        }
        // 错误响应
        const errorBody = (await response.json());
        core_1.Logger.error(`WeChat wxacode failed: ${JSON.stringify(errorBody)}`, constants_1.loggerCtx);
        throw new Error(`微信小程序码生成失败: ${errorBody.errcode} ${errorBody.errmsg}`);
    }
    checkRateLimit(userId) {
        const now = Date.now();
        const record = this.userCallCount.get(userId);
        if (!record || record.resetAt < now) {
            this.userCallCount.set(userId, { count: 1, resetAt: now + 60000 });
            return;
        }
        if (record.count >= this.MAX_CALLS_PER_MINUTE) {
            throw new Error('调用过于频繁，请稍后再试');
        }
        record.count++;
    }
};
exports.WxacodeService = WxacodeService;
exports.WxacodeService = WxacodeService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(constants_1.WECHAT_AUTH_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [wechat_auth_service_1.WechatAuthService, Object])
], WxacodeService);
//# sourceMappingURL=wxacode.service.js.map