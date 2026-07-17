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
exports.AuthAdminResolver = void 0;
// e:\code\vendure\packages\cjk-plugin\src\auth\auth-admin.resolver.ts
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const auth_config_service_1 = require("./auth-config.service");
let AuthAdminResolver = class AuthAdminResolver {
    constructor(channelService, authConfigService) {
        this.channelService = channelService;
        this.authConfigService = authConfigService;
    }
    assertChannelAccess(ctx, channelId) {
        var _a, _b;
        if (ctx.userHasPermissions([core_1.Permission.SuperAdmin]))
            return;
        const channelPermissions = ((_b = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.channelPermissions) || [];
        const allowed = channelPermissions.some((c) => String(c.id) === String(channelId));
        if (!allowed)
            throw new Error('TENANT_CONFIG_FORBIDDEN');
    }
    async channelAuthConfig(ctx, args) {
        this.assertChannelAccess(ctx, args.channelId);
        return this.authConfigService.getMasked(ctx, args.channelId);
    }
    async updateChannelAuthConfig(ctx, args) {
        this.assertChannelAccess(ctx, args.channelId);
        return this.authConfigService.update(ctx, args.channelId, args.input);
    }
};
exports.AuthAdminResolver = AuthAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AuthAdminResolver.prototype, "channelAuthConfig", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AuthAdminResolver.prototype, "updateChannelAuthConfig", null);
exports.AuthAdminResolver = AuthAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(core_1.ChannelService)),
    __param(1, (0, common_1.Inject)(auth_config_service_1.AuthConfigService)),
    __metadata("design:paramtypes", [core_1.ChannelService,
        auth_config_service_1.AuthConfigService])
], AuthAdminResolver);
//# sourceMappingURL=auth-admin.resolver.js.map