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
exports.WechatAuthShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const wechat_auth_service_1 = require("./wechat-auth.service");
const wxacode_service_1 = require("./wxacode.service");
let WechatAuthShopResolver = class WechatAuthShopResolver {
    constructor(wechatAuthService, wxacodeService) {
        this.wechatAuthService = wechatAuthService;
        this.wxacodeService = wxacodeService;
    }
    async wechatJsapiSignature(url) {
        return this.wechatAuthService.generateJsapiSignature(url);
    }
    async wechatWxacode(ctx, scene, path, width) {
        return this.wxacodeService.generateWxacode(ctx, { scene, path, width });
    }
};
exports.WechatAuthShopResolver = WechatAuthShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, graphql_1.Args)('url')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WechatAuthShopResolver.prototype, "wechatJsapiSignature", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('scene')),
    __param(2, (0, graphql_1.Args)({ name: 'path', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'width', type: () => graphql_1.Int, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, Number]),
    __metadata("design:returntype", Promise)
], WechatAuthShopResolver.prototype, "wechatWxacode", null);
exports.WechatAuthShopResolver = WechatAuthShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [wechat_auth_service_1.WechatAuthService,
        wxacode_service_1.WxacodeService])
], WechatAuthShopResolver);
//# sourceMappingURL=wechat-auth-shop.resolver.js.map