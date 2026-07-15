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
const crypto_1 = require("./crypto");
let AuthAdminResolver = class AuthAdminResolver {
    constructor(channelService) {
        this.channelService = channelService;
    }
    async channelAuthConfig(ctx, args) {
        var _a;
        const channel = await this.channelService.findOne(ctx, args.channelId);
        if (!channel)
            return null;
        const rawStruct = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.authConfig;
        if (!rawStruct)
            return null;
        const domain = (0, crypto_1.parseAndDecryptStruct)(rawStruct);
        return (0, crypto_1.maskAuthConfig)(domain);
    }
    async updateChannelAuthConfig(ctx, args) {
        var _a;
        const channel = await this.channelService.findOne(ctx, args.channelId);
        if (!channel)
            return false;
        const originalStruct = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.authConfig;
        const originalDomain = originalStruct ? (0, crypto_1.parseAndDecryptStruct)(originalStruct) : null;
        // input 是 domain 形状（含 *** 表示保留原值）
        const merged = (0, crypto_1.mergeAuthConfig)(originalDomain, args.input);
        const newStruct = (0, crypto_1.serializeAuthConfigToStruct)(merged);
        await this.channelService.update(ctx, {
            id: args.channelId,
            customFields: { authConfig: newStruct },
        });
        return true;
    }
};
exports.AuthAdminResolver = AuthAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AuthAdminResolver.prototype, "channelAuthConfig", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AuthAdminResolver.prototype, "updateChannelAuthConfig", null);
exports.AuthAdminResolver = AuthAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(core_1.ChannelService)),
    __metadata("design:paramtypes", [core_1.ChannelService])
], AuthAdminResolver);
//# sourceMappingURL=auth-admin.resolver.js.map