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
exports.DomainResolverService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
let DomainResolverService = class DomainResolverService {
    constructor(channelService) {
        this.channelService = channelService;
    }
    async resolveByDomain(ctx, host) {
        var _a;
        const normalizedHost = host.split(':')[0].toLowerCase();
        // 使用 emptyCtx 跨 channel 查询，避免公共请求 ctx 的潜在 channel 过滤
        // 与 group-buy-plugin / distribution-plugin 的既定模式一致
        const emptyCtx = core_1.RequestContext.empty();
        const channels = await this.channelService.findAll(emptyCtx);
        for (const channel of channels.items) {
            const domains = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.customDomains;
            if (domains === null || domains === void 0 ? void 0 : domains.some(d => d.toLowerCase() === normalizedHost)) {
                return { token: channel.token, code: channel.code };
            }
        }
        return null;
    }
    async resolveByCode(ctx, code) {
        var _a, _b, _c, _d, _e, _f, _g;
        const emptyCtx = core_1.RequestContext.empty();
        const channels = await this.channelService.findAll(emptyCtx);
        for (const channel of channels.items) {
            if (channel.code === code) {
                const cf = channel.customFields || {};
                return {
                    token: channel.token,
                    code: channel.code,
                    customFields: {
                        shopName: (_a = cf.shopName) !== null && _a !== void 0 ? _a : null,
                        shopLogo: (_b = cf.shopLogo) !== null && _b !== void 0 ? _b : null,
                        shopIntro: (_c = cf.shopIntro) !== null && _c !== void 0 ? _c : null,
                        servicePhone: (_d = cf.servicePhone) !== null && _d !== void 0 ? _d : null,
                        shopContent: (_e = cf.shopContent) !== null && _e !== void 0 ? _e : null,
                        displayTemplate: (_f = cf.displayTemplate) !== null && _f !== void 0 ? _f : null,
                        themeId: (_g = cf.themeId) !== null && _g !== void 0 ? _g : null,
                    },
                };
            }
        }
        return null;
    }
};
exports.DomainResolverService = DomainResolverService;
exports.DomainResolverService = DomainResolverService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], DomainResolverService);
//# sourceMappingURL=domain-resolver.service.js.map