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
exports.AuthShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const crypto_1 = require("./crypto");
const sso_authentication_strategy_1 = require("./sso-authentication-strategy");
let AuthShopResolver = class AuthShopResolver {
    authMethods(ctx) {
        var _a;
        // readChannelAuthConfig 是同步函数，无需 async/await
        const config = (0, crypto_1.readChannelAuthConfig)(ctx);
        if (!(config === null || config === void 0 ? void 0 : config.enabledMethods)) {
            // 向后兼容：返回所有已注册策略
            return { methods: ['native', 'phone', 'wechat', 'alipay', 'douyin'], wechatAppId: null };
        }
        let wechatAppId = null;
        if (config.enabledMethods.includes('wechat')) {
            const wechatOverride = (_a = config.overrides) === null || _a === void 0 ? void 0 : _a.wechat;
            wechatAppId = (wechatOverride === null || wechatOverride === void 0 ? void 0 : wechatOverride.appId) || null;
        }
        return { methods: config.enabledMethods, wechatAppId };
    }
    ssoProviders(ctx) {
        const config = (0, crypto_1.readChannelAuthConfig)(ctx);
        if (!(config === null || config === void 0 ? void 0 : config.ssoProviders))
            return [];
        return config.ssoProviders.map((p) => ({
            name: p.name,
            providerKey: p.providerKey,
            protocol: p.protocol,
            baseUrl: p.baseUrl,
            authorizeUrl: p.authorizeUrl,
            clientId: p.clientId,
            scopes: p.scopes || [],
            channelCode: p.channelCode,
        }));
    }
    /**
     * 方向B：已登录本地账号绑定 SSO 身份（SSO↔本地账号互认）。
     * 校验 code → 得外部身份 → 挂到当前已登录 User。
     */
    async bindSsoIdentity(ctx, providerKey, code, redirectUri) {
        var _a;
        if (!ctx.activeUserId) {
            throw new core_1.ForbiddenError();
        }
        const config = (0, crypto_1.readChannelAuthConfig)(ctx);
        const provider = (_a = config === null || config === void 0 ? void 0 : config.ssoProviders) === null || _a === void 0 ? void 0 : _a.find((p) => p.providerKey === providerKey);
        if (!provider) {
            return { bound: false, userId: String(ctx.activeUserId), reason: 'sso provider not configured' };
        }
        return sso_authentication_strategy_1.ssoAuthenticationStrategy.bindIdentityToUser(ctx, provider, code, String(ctx.activeUserId), redirectUri);
    }
};
exports.AuthShopResolver = AuthShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Object)
], AuthShopResolver.prototype, "authMethods", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Array)
], AuthShopResolver.prototype, "ssoProviders", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('providerKey')),
    __param(2, (0, graphql_1.Args)('code')),
    __param(3, (0, graphql_1.Args)('redirectUri', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, String]),
    __metadata("design:returntype", Promise)
], AuthShopResolver.prototype, "bindSsoIdentity", null);
exports.AuthShopResolver = AuthShopResolver = __decorate([
    (0, graphql_1.Resolver)()
], AuthShopResolver);
//# sourceMappingURL=auth-shop.resolver.js.map