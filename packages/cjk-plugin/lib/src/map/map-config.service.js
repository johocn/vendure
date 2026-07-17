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
exports.MapConfigService = void 0;
// packages/cjk-plugin/src/map/map-config.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const map_crypto_1 = require("./map-crypto");
let MapConfigService = class MapConfigService {
    constructor(channelService) {
        this.channelService = channelService;
    }
    async getMasked(ctx, channelId) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.mapConfig;
        if (!raw)
            return null;
        return (0, map_crypto_1.maskMapConfig)((0, map_crypto_1.decryptMapConfig)(raw));
    }
    async getDecrypted(ctx, channelId) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.mapConfig;
        if (!raw)
            return null;
        return (0, map_crypto_1.decryptMapConfig)(raw);
    }
    async update(ctx, channelId, patch) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.mapConfig;
        const original = (0, map_crypto_1.decryptMapConfig)(raw || null);
        const merged = (0, map_crypto_1.mergeMapConfig)(original, patch);
        const encrypted = (0, map_crypto_1.encryptMapConfig)(merged);
        await this.channelService.update(ctx, { id: channelId, customFields: { mapConfig: encrypted } });
        return this.getMasked(ctx, channelId);
    }
};
exports.MapConfigService = MapConfigService;
exports.MapConfigService = MapConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], MapConfigService);
//# sourceMappingURL=map-config.service.js.map