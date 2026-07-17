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
exports.MapService = void 0;
// e:\code\vendure\packages\cjk-plugin\src\map\map.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const map_crypto_1 = require("./map-crypto");
const map_provider_registry_1 = require("./map-provider-registry");
const i18n_messages_1 = require("../pickup/i18n-messages");
let MapService = class MapService {
    constructor(registry, channelService) {
        this.registry = registry;
        this.channelService = channelService;
    }
    /**
     * 从 Channel 的 customFields.mapConfig 读取配置
     * - 传入 channelId 时读指定 channel
     * - 否则优先用当前 channel，回退到默认 Channel
     * 读出的 raw 加密 config 解密后再返回
     */
    async getConfigForChannel(ctx, channelId) {
        var _a, _b, _c, _d;
        let config;
        if (channelId) {
            // 读指定 channel
            const channel = await this.channelService.findOne(ctx, channelId);
            config = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _a === void 0 ? void 0 : _a.mapConfig;
        }
        else {
            // 优先用当前 channel
            config = (_c = (_b = ctx.channel) === null || _b === void 0 ? void 0 : _b.customFields) === null || _c === void 0 ? void 0 : _c.mapConfig;
            if (!config) {
                const defaultChannel = await this.channelService.getDefaultChannel(ctx);
                config = (_d = defaultChannel === null || defaultChannel === void 0 ? void 0 : defaultChannel.customFields) === null || _d === void 0 ? void 0 : _d.mapConfig;
            }
        }
        // 解密后返回(加密格式 enc:xxx → 明文)
        return config ? (0, map_crypto_1.decryptMapConfig)(config) : null;
    }
    /**
     * 包装 provider 调用，捕获 i18n 错误并翻译
     */
    async callProvider(ctx, fn) {
        var _a, _b, _c;
        try {
            return await fn();
        }
        catch (err) {
            if ((err === null || err === void 0 ? void 0 : err.i18nKey) === 'MAP_PROVIDER_NOT_REGISTERED') {
                const vars = (_a = err.i18nVars) !== null && _a !== void 0 ? _a : {};
                const msg = (0, i18n_messages_1.translateError)(ctx, 'MAP_PROVIDER_NOT_REGISTERED')
                    .replace('{provider}', (_b = vars.provider) !== null && _b !== void 0 ? _b : '');
                throw new Error(msg);
            }
            // provider 内部抛出的普通 Error（含 HTTP 错误信息）
            const msg = (0, i18n_messages_1.translateError)(ctx, 'MAP_PROVIDER_API_ERROR')
                .replace('{message}', (_c = err === null || err === void 0 ? void 0 : err.message) !== null && _c !== void 0 ? _c : 'unknown');
            throw new Error(msg);
        }
    }
    getProvider(config) {
        return this.registry.get(config.provider);
    }
    /**
     * 掩码 apiKey，用于 channelMapConfig 查询（展示用）
     */
    maskApiKey(key) {
        if (key.length <= 8)
            return '****';
        return key.slice(0, 4) + '****' + key.slice(-4);
    }
    async getDistricts(ctx, parentAdcode) {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            throw new Error((0, i18n_messages_1.translateError)(ctx, 'MAP_CONFIG_NOT_CONFIGURED'));
        }
        const provider = this.getProvider(config);
        return this.callProvider(ctx, () => provider.fetchDistricts(parentAdcode, config.apiKey));
    }
    async reverseGeocode(ctx, lat, lng) {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            throw new Error((0, i18n_messages_1.translateError)(ctx, 'MAP_CONFIG_NOT_CONFIGURED'));
        }
        const provider = this.getProvider(config);
        return this.callProvider(ctx, () => provider.reverseGeocode(lat, lng, config.apiKey));
    }
    async getSdkConfig(ctx) {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            return { provider: '', sdkUrl: '', hasConfigured: false };
        }
        const provider = this.getProvider(config);
        const sdkUrl = provider.getSdkLoaderUrl(config.apiKey, config.securityJsCode);
        return { provider: config.provider, sdkUrl, hasConfigured: true };
    }
    async getChannelMapConfig(ctx, channelId) {
        const config = await this.getConfigForChannel(ctx, channelId);
        if (!config) {
            return { provider: '', apiKey: '', hasConfigured: false };
        }
        return {
            provider: config.provider,
            apiKey: this.maskApiKey(config.apiKey),
            hasConfigured: true,
        };
    }
};
exports.MapService = MapService;
exports.MapService = MapService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [map_provider_registry_1.MapProviderRegistry,
        core_1.ChannelService])
], MapService);
//# sourceMappingURL=map.service.js.map