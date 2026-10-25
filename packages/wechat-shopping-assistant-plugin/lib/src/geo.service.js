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
var GeoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoService = void 0;
const common_1 = require("@nestjs/common");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/** 中国陆地经纬度范围（不含港澳台细化边界），用于挡掉 0,0 与境外坐标 */
const CHINA_BOUNDS = { minLat: 3.86, maxLat: 53.55, minLng: 73.66, maxLng: 135.09 };
const SUCCESS_TTL = 30 * 24 * 60 * 60000;
const FAIL_TTL = 10 * 60000;
const MAX_CACHE = 500;
/** 聊天链路 5 秒窗口：单次地理编码超时压到 1.2s，失败快速走降级/追问 */
const CHAT_TIMEOUT_MS = 1200;
/**
 * 地理编码服务（购物助手专用）：
 * - 正向：地址文本 → 坐标（带文本清洗、城市提示、多候选降级、进程内缓存）
 * - 逆向：微信位置坐标 → 省市区 + 格式化地址
 * - 坐标守卫：仅接受中国范围内有效坐标
 * 所有方法失败返回 null，不向上抛错（聊天链路不因地图服务异常中断）。
 */
let GeoService = GeoService_1 = class GeoService {
    constructor(mapService) {
        this.mapService = mapService;
        this.geocodeCache = new Map();
        this.reverseCache = new Map();
    }
    /** 坐标是否可用：有限数值、非 0,0、在中国范围内 */
    static isValidCoordinate(lat, lng) {
        return (Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            !(lat === 0 && lng === 0) &&
            lat >= CHINA_BOUNDS.minLat &&
            lat <= CHINA_BOUNDS.maxLat &&
            lng >= CHINA_BOUNDS.minLng &&
            lng <= CHINA_BOUNDS.maxLng);
    }
    /** 逆向结果拼成一句话地址；优先地图格式化地址，缺失时用省市区 + 用户上报描述兜底 */
    static composeAddressText(reverse, label) {
        var _a;
        const formatted = ((_a = reverse === null || reverse === void 0 ? void 0 : reverse.formattedAddress) !== null && _a !== void 0 ? _a : '').trim();
        if (formatted.length >= 8)
            return formatted;
        const joined = [reverse === null || reverse === void 0 ? void 0 : reverse.province, reverse === null || reverse === void 0 ? void 0 : reverse.city, reverse === null || reverse === void 0 ? void 0 : reverse.district, reverse === null || reverse === void 0 ? void 0 : reverse.street, label]
            .filter((v) => !!v && v.length > 0)
            .join('');
        return joined || (label !== null && label !== void 0 ? label : '').trim();
    }
    /** 地址文本 → 坐标；失败返回 null */
    async geocode(ctx, address, hint) {
        var _a;
        const text = normalizeAddressText(address);
        if (!text || text.length < 6 || !this.mapService)
            return null;
        const cityHint = ((_a = hint === null || hint === void 0 ? void 0 : hint.city) === null || _a === void 0 ? void 0 : _a.trim()) || undefined;
        const key = `g:${cityHint !== null && cityHint !== void 0 ? cityHint : ''}|${text}`;
        const cached = this.readCache(this.geocodeCache, key);
        if (cached !== undefined)
            return cached;
        let lastError;
        for (const candidate of buildCandidates(text, cityHint)) {
            try {
                const result = await this.mapService.geocode(ctx, candidate, CHAT_TIMEOUT_MS);
                if (result && GeoService_1.isValidCoordinate(result.lat, result.lng)) {
                    this.writeCache(this.geocodeCache, key, result, SUCCESS_TTL);
                    return result;
                }
            }
            catch (e) {
                lastError = e;
            }
        }
        this.writeCache(this.geocodeCache, key, null, FAIL_TTL);
        core_1.Logger.warn(`Assistant geocode failed: "${text.slice(0, 40)}" ${lastError ? String(lastError) : ''}`, constants_1.loggerCtx);
        return null;
    }
    /** 微信位置坐标 → 结构化地址；失败返回 null */
    async reverse(ctx, lat, lng) {
        if (!this.mapService || !GeoService_1.isValidCoordinate(lat, lng))
            return null;
        // 约 11m 精度取整，避免同一点重复请求
        const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
        const cached = this.readCache(this.reverseCache, key);
        if (cached !== undefined)
            return cached;
        try {
            const result = await this.mapService.reverseGeocode(ctx, lat, lng);
            if (!result)
                return null;
            this.writeCache(this.reverseCache, key, result, SUCCESS_TTL);
            return result;
        }
        catch (e) {
            core_1.Logger.warn(`Assistant reverse geocode failed: ${String(e)}`, constants_1.loggerCtx);
            this.writeCache(this.reverseCache, key, null, FAIL_TTL);
            return null;
        }
    }
    readCache(cache, key) {
        const hit = cache.get(key);
        if (!hit)
            return undefined;
        if (hit.expiresAt < Date.now()) {
            cache.delete(key);
            return undefined;
        }
        return hit.value;
    }
    writeCache(cache, key, value, ttlMs) {
        if (cache.size >= MAX_CACHE) {
            // Map 按插入顺序迭代：删最旧一条
            const oldest = cache.keys().next().value;
            if (oldest !== undefined)
                cache.delete(oldest);
        }
        cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
};
exports.GeoService = GeoService;
exports.GeoService = GeoService = GeoService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [cjk_plugin_1.MapService])
], GeoService);
/** 地址文本清洗：去首尾空白、压缩连续空白、去常见备注括号 */
function normalizeAddressText(address) {
    const raw = String(address !== null && address !== void 0 ? address : '').replace(/\s+/g, ' ').trim();
    if (!raw)
        return '';
    return raw.replace(/[（(][^（）()]*[）)]/g, '').replace(/\s+/g, ' ').trim();
}
/**
 * 编码候选降级链：完整地址（带城市限定）→ 去备注主干 → 长文本截取到区/路级别。
 * 地图 API 对超长/夹带备注的地址命中率明显下降，逐级回退提升成功率。
 */
function buildCandidates(text, city) {
    const seen = new Set();
    const candidates = [];
    const push = (address, cityHint) => {
        const value = address.trim();
        if (!value)
            return;
        const key = `${cityHint !== null && cityHint !== void 0 ? cityHint : ''}|${value}`;
        if (seen.has(key))
            return;
        seen.add(key);
        candidates.push({ address: value, city: cityHint });
    };
    push(text, city);
    if (text.length > 30)
        push(text.slice(0, 30), city);
    push(text, undefined);
    return candidates;
}
//# sourceMappingURL=geo.service.js.map