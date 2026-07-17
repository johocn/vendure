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
exports.AuthConfigService = void 0;
// packages/cjk-plugin/src/auth/auth-config.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const crypto_1 = require("./crypto");
let AuthConfigService = class AuthConfigService {
    constructor(channelService) {
        this.channelService = channelService;
    }
    async getMasked(ctx, channelId) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const rawStruct = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.authConfig;
        if (!rawStruct)
            return null;
        const domain = (0, crypto_1.parseAndDecryptStruct)(rawStruct);
        return (0, crypto_1.maskAuthConfig)(domain);
    }
    async update(ctx, channelId, patch) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const originalStruct = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.authConfig;
        const originalDomain = originalStruct ? (0, crypto_1.parseAndDecryptStruct)(originalStruct) : null;
        const merged = (0, crypto_1.mergeAuthConfig)(originalDomain, patch);
        const newStruct = (0, crypto_1.serializeAuthConfigToStruct)(merged);
        await this.channelService.update(ctx, { id: channelId, customFields: { authConfig: newStruct } });
        return this.getMasked(ctx, channelId);
    }
};
exports.AuthConfigService = AuthConfigService;
exports.AuthConfigService = AuthConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], AuthConfigService);
//# sourceMappingURL=auth-config.service.js.map