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
exports.WechatOfficialResolver = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const wechat_auth_service_1 = require("./wechat-auth.service");
/**
 * 公众号运营 admin API（菜单 / 粉丝 / 模板消息）——微信 cgi-bin 的 GraphQL 代理。
 * 安全：无 @Allow 时 Vendure 默认放行（permissions.length===0 → allow），
 * 匿名即可调用（发布菜单 / 群发模板消息危害大），故显式要求 SuperAdmin；
 * 与 web-admin 前端「仅超管可见」的门禁保持一致。
 */
let WechatOfficialResolver = class WechatOfficialResolver {
    constructor(options, wechatAuthService) {
        this.options = options;
        this.wechatAuthService = wechatAuthService;
    }
    async wechatCurrentMenu(ctx) {
        return this.wechatAuthService.getOfficialMenu();
    }
    async wechatMenuPublish(ctx, menu) {
        return this.wechatAuthService.createOfficialMenu(menu);
    }
    async wechatMenuDelete(ctx) {
        return this.wechatAuthService.deleteOfficialMenu();
    }
    async wechatFans(ctx, nextOpenid) {
        return this.wechatAuthService.getFans(nextOpenid || undefined);
    }
    async wechatTemplates(ctx) {
        return this.wechatAuthService.getTemplates();
    }
    async wechatTemplateSend(ctx, input) {
        return this.wechatAuthService.sendTemplate(input);
    }
};
exports.WechatOfficialResolver = WechatOfficialResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], WechatOfficialResolver.prototype, "wechatCurrentMenu", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('menu')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], WechatOfficialResolver.prototype, "wechatMenuPublish", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], WechatOfficialResolver.prototype, "wechatMenuDelete", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('nextOpenid', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], WechatOfficialResolver.prototype, "wechatFans", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], WechatOfficialResolver.prototype, "wechatTemplates", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], WechatOfficialResolver.prototype, "wechatTemplateSend", null);
exports.WechatOfficialResolver = WechatOfficialResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(constants_1.WECHAT_AUTH_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, wechat_auth_service_1.WechatAuthService])
], WechatOfficialResolver);
//# sourceMappingURL=wechat-official.resolver.js.map