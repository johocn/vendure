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
const wechat_auth_service_1 = require("./wechat-auth.service");
let WechatAuthShopResolver = class WechatAuthShopResolver {
    constructor(wechatAuthService) {
        this.wechatAuthService = wechatAuthService;
    }
    async wechatJsapiSignature(url) {
        return this.wechatAuthService.generateJsapiSignature(url);
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
exports.WechatAuthShopResolver = WechatAuthShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [wechat_auth_service_1.WechatAuthService])
], WechatAuthShopResolver);
//# sourceMappingURL=wechat-auth-shop.resolver.js.map