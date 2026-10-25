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
exports.DeliveryGuardService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const geo_service_1 = require("../geo.service");
const address_parser_1 = require("./address-parser");
const loggerCtx = 'WechatAssistantDeliveryGuard';
/**
 * 配送守卫：地址解析 + 城市级范围判定。
 * 判定依据为渠道 `servingCities`（服务城市码）；未配置的渠道视为不限（线上历史渠道均未配置）。
 */
let DeliveryGuardService = class DeliveryGuardService {
    constructor(connection, geoService) {
        this.connection = connection;
        this.geoService = geoService;
    }
    /** 只做地理编码 + 字段解析，不判定范围（供租户路由先用城市选店） */
    async parse(ctx, addressText) {
        const geo = await this.geoService.geocode(ctx, addressText);
        if (!geo) {
            common_1.Logger.warn(`Delivery guard geocode failed: "${addressText.slice(0, 40)}"`, loggerCtx);
            return null;
        }
        return (0, address_parser_1.buildParsedAddress)(geo, addressText);
    }
    /** 解析 + 校验（外部一律用这个方法，避免漏掉 geocode 失败分支） */
    async check(ctx, channelId, addressText) {
        const parsed = await this.parse(ctx, addressText);
        if (!parsed)
            return { status: 'UNKNOWN', serviceAreaText: '', parsed: null };
        return this.checkParsed(ctx, channelId, parsed);
    }
    /** 已解析地址的范围判定：地址城市码是否在渠道服务城市内 */
    async checkParsed(ctx, channelId, parsed) {
        var _a;
        // rawConnection：按显式 channelId 查，避免 ctx 通道过滤挡住跨租户校验
        const channel = await this.connection.rawConnection
            .getRepository(core_1.Channel)
            .findOne({ where: { id: Number(channelId) } });
        const servingCities = this.servingCities(channel);
        if (!servingCities.length)
            return { status: 'OK', serviceAreaText: '', parsed };
        if (parsed.cityCode && servingCities.includes(parsed.cityCode)) {
            return { status: 'OK', serviceAreaText: '', parsed };
        }
        common_1.Logger.log(`Delivery out of range: channel=${channelId} city=${(_a = parsed.cityCode) !== null && _a !== void 0 ? _a : '-'}`, loggerCtx);
        return {
            status: 'OUT_OF_RANGE',
            reason: 'CITY_NOT_SERVED',
            // 直辖市场景地图只回省份（city 为空），用省份兜底，避免向用户暴露城市码
            serviceAreaText: `本店目前不服务「${parsed.city || parsed.province || parsed.cityCode || '该'}」地区的地址。`,
            parsed,
        };
    }
    servingCities(channel) {
        var _a;
        const raw = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _a === void 0 ? void 0 : _a.servingCities;
        return Array.isArray(raw) ? raw.map(String) : [];
    }
};
exports.DeliveryGuardService = DeliveryGuardService;
exports.DeliveryGuardService = DeliveryGuardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        geo_service_1.GeoService])
], DeliveryGuardService);
//# sourceMappingURL=delivery-guard.service.js.map