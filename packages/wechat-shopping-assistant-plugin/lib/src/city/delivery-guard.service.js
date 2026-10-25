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
    /**
     * 只做地理编码 + 字段解析，不判定范围（供租户路由先用城市选店）。
     * coords 为地址簿已存坐标：地理编码超时/网络失败时用它逆地理取行政区，再补取区划码。
     */
    async parse(ctx, addressText, coords) {
        const geo = await this.geoService.geocode(ctx, addressText);
        if (geo)
            return (0, address_parser_1.buildParsedAddress)(geo, addressText);
        const fallback = await this.parseByCoordinates(ctx, addressText, coords);
        if (fallback)
            return fallback;
        common_1.Logger.warn(`Delivery guard geocode failed: "${addressText.slice(0, 40)}"`, loggerCtx);
        return null;
    }
    /** 解析 + 校验（外部一律用这个方法，避免漏掉 geocode 失败分支） */
    async check(ctx, channelId, addressText, coords) {
        const parsed = await this.parse(ctx, addressText, coords);
        if (!parsed)
            return { status: 'UNKNOWN', serviceAreaText: '', parsed: null };
        return this.checkParsed(ctx, channelId, parsed);
    }
    /**
     * 坐标兜底：逆地理得到省/市/区文本，再用这段短文本取区划码（短文本命中快，规避长地址超时）。
     * 逆地理本身失败时返回 null，调用方仍按 fail closed 处理。
     */
    async parseByCoordinates(ctx, addressText, coords) {
        if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng))
            return null;
        const reverse = await this.geoService.reverse(ctx, coords.lat, coords.lng);
        const admin = [reverse === null || reverse === void 0 ? void 0 : reverse.province, reverse === null || reverse === void 0 ? void 0 : reverse.city, reverse === null || reverse === void 0 ? void 0 : reverse.district].filter(Boolean).join('');
        if (admin.length < 2)
            return null;
        const geo = await this.geoService.geocode(ctx, admin);
        if (!geo)
            return null;
        common_1.Logger.log(`Delivery guard geocode fallback by coordinates: ${admin}`, loggerCtx);
        // 坐标以地址簿存值为准；格式化地址沿用用户填写的原文
        return (0, address_parser_1.buildParsedAddress)(Object.assign(Object.assign({}, geo), { formattedAddress: addressText, lat: coords.lat, lng: coords.lng }), addressText);
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
            serviceAreaText: `本店目前不服务「${areaLabel(parsed)}」地区的地址。`,
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
/**
 * 超范围文案的「地区」展示名：
 * 直辖市等高德只回区县或空省市时，从地址原文取「xx市/自治州/地区/盟」，
 * 避免向用户暴露城市码（110100）。
 */
function areaLabel(parsed) {
    if (parsed.city)
        return parsed.city;
    if (parsed.province)
        return parsed.province;
    const m = /^(.{2,10}?(?:市|自治州|地区|盟))/.exec(parsed.streetLine1 || '');
    if (m)
        return m[1];
    return parsed.district || parsed.cityCode || '该';
}
//# sourceMappingURL=delivery-guard.service.js.map