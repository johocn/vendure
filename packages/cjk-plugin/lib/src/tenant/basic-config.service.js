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
exports.BasicConfigService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
function parseJson(value) {
    if (!value)
        return undefined;
    try {
        return JSON.parse(value);
    }
    catch (_a) {
        return undefined;
    }
}
function stringify(value) {
    return value == null ? null : JSON.stringify(value);
}
let BasicConfigService = class BasicConfigService {
    constructor(channelService) {
        this.channelService = channelService;
    }
    parseStruct(raw) {
        if (!raw)
            return null;
        const out = {};
        if (raw.tenantName != null)
            out.tenantName = raw.tenantName;
        if (raw.contactPhone != null)
            out.contactPhone = raw.contactPhone;
        if (raw.address != null)
            out.address = raw.address;
        if (raw.timeZoneId != null)
            out.timeZoneId = raw.timeZoneId;
        const invoiceHeader = parseJson(raw.invoiceHeaderJson);
        if (invoiceHeader)
            out.invoiceHeader = invoiceHeader;
        const serviceContacts = parseJson(raw.serviceContactsJson);
        if (serviceContacts)
            out.serviceContacts = serviceContacts;
        return Object.keys(out).length > 0 ? out : null;
    }
    serializeDomain(domain) {
        var _a, _b, _c, _d;
        return {
            tenantName: (_a = domain === null || domain === void 0 ? void 0 : domain.tenantName) !== null && _a !== void 0 ? _a : null,
            contactPhone: (_b = domain === null || domain === void 0 ? void 0 : domain.contactPhone) !== null && _b !== void 0 ? _b : null,
            address: (_c = domain === null || domain === void 0 ? void 0 : domain.address) !== null && _c !== void 0 ? _c : null,
            timeZoneId: (_d = domain === null || domain === void 0 ? void 0 : domain.timeZoneId) !== null && _d !== void 0 ? _d : null,
            invoiceHeaderJson: stringify(domain === null || domain === void 0 ? void 0 : domain.invoiceHeader),
            serviceContactsJson: stringify(domain === null || domain === void 0 ? void 0 : domain.serviceContacts),
        };
    }
    async get(ctx, channelId) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.basicConfig;
        return this.parseStruct(raw);
    }
    async update(ctx, channelId, patch) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const original = this.parseStruct((_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.basicConfig) || {};
        const merged = Object.assign(Object.assign({}, original), (patch || {}));
        await this.channelService.update(ctx, { id: channelId, customFields: { basicConfig: this.serializeDomain(merged) } });
        return merged;
    }
};
exports.BasicConfigService = BasicConfigService;
exports.BasicConfigService = BasicConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], BasicConfigService);
//# sourceMappingURL=basic-config.service.js.map