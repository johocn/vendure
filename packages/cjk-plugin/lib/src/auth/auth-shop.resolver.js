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
exports.AuthShopResolver = AuthShopResolver = __decorate([
    (0, graphql_1.Resolver)()
], AuthShopResolver);
//# sourceMappingURL=auth-shop.resolver.js.map