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
exports.PayConfigService = void 0;
// packages/cjk-plugin/src/payment/pay-config.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const pay_config_crypto_1 = require("./pay-config-crypto");
let PayConfigService = class PayConfigService {
    constructor(channelService) {
        this.channelService = channelService;
    }
    parseStruct(raw) {
        if (!raw)
            return null;
        const out = {};
        if (raw.alipayJson) {
            try {
                out.alipay = JSON.parse(raw.alipayJson);
            }
            catch (_a) { }
        }
        if (raw.wechatpayJson) {
            try {
                out.wechatpay = JSON.parse(raw.wechatpayJson);
            }
            catch (_b) { }
        }
        if (raw.douyinpayJson) {
            try {
                out.douyinpay = JSON.parse(raw.douyinpayJson);
            }
            catch (_c) { }
        }
        return Object.keys(out).length > 0 ? out : null;
    }
    serializeDomain(domain) {
        return {
            alipayJson: (domain === null || domain === void 0 ? void 0 : domain.alipay) ? JSON.stringify(domain.alipay) : '',
            wechatpayJson: (domain === null || domain === void 0 ? void 0 : domain.wechatpay) ? JSON.stringify(domain.wechatpay) : '',
            douyinpayJson: (domain === null || domain === void 0 ? void 0 : domain.douyinpay) ? JSON.stringify(domain.douyinpay) : '',
        };
    }
    async getMasked(ctx, channelId) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.payConfig;
        const domain = this.parseStruct(raw);
        return (0, pay_config_crypto_1.maskPayConfig)((0, pay_config_crypto_1.decryptPayConfig)(domain));
    }
    async update(ctx, channelId, patch) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.payConfig;
        const original = (0, pay_config_crypto_1.decryptPayConfig)(this.parseStruct(raw));
        const merged = (0, pay_config_crypto_1.mergePayConfig)(original, patch);
        const encrypted = (0, pay_config_crypto_1.encryptPayConfig)(merged);
        const newStruct = this.serializeDomain(encrypted);
        await this.channelService.update(ctx, { id: channelId, customFields: { payConfig: newStruct } });
        return this.getMasked(ctx, channelId);
    }
};
exports.PayConfigService = PayConfigService;
exports.PayConfigService = PayConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], PayConfigService);
//# sourceMappingURL=pay-config.service.js.map