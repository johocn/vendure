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
exports.TenantRouterService = void 0;
const common_1 = require("@nestjs/common");
const city_catalog_service_1 = require("./city-catalog.service");
const tenant_router_1 = require("./tenant-router");
let TenantRouterService = class TenantRouterService {
    constructor(catalog) {
        this.catalog = catalog;
    }
    async resolve(ctx, input) {
        var _a, _b, _c;
        const index = await this.catalog.getIndex(ctx);
        const cityHits = input.cityCode ? ((_a = index.byCity.get(input.cityCode)) !== null && _a !== void 0 ? _a : []) : [];
        // 半径渠道：用户坐标 + 圆心坐标都齐全才计算距离；缺圆心则 distanceKm 保持 null，
        // 被 rankCandidates 过滤掉（不猜，交由 delivery-guard 明确拒绝）
        const others = index.allChannels.map(c => {
            if (c.precision !== 'circle')
                return c;
            if (input.lat == null || input.lng == null || c.centerLat == null || c.centerLng == null)
                return c;
            return Object.assign(Object.assign({}, c), { distanceKm: haversineKm(input.lat, input.lng, c.centerLat, c.centerLng) });
        });
        const candidates = (0, tenant_router_1.rankCandidates)([...cityHits, ...others]).slice(0, 3);
        const currentChannelId = String((_b = input.currentChannelId) !== null && _b !== void 0 ? _b : '');
        // 只切到「显式服务该城市」的渠道；当前渠道本身就显式服务该城市时保持不动（避免无谓切店）。
        // 全渠道未配置 servingCities 时没有显式候选 → 永不切店。
        const currentServes = candidates.some(c => c.channelId === currentChannelId && c.precision === 'explicit');
        const best = (_c = candidates[0]) !== null && _c !== void 0 ? _c : null;
        const chosen = !currentServes && (best === null || best === void 0 ? void 0 : best.precision) === 'explicit' ? best : null;
        return {
            chosen,
            candidates,
            ambiguous: candidates.length > 1 && candidates[0].precision === candidates[1].precision,
            currentInCandidates: candidates.some(c => c.channelId === currentChannelId),
        };
    }
};
exports.TenantRouterService = TenantRouterService;
exports.TenantRouterService = TenantRouterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [city_catalog_service_1.CityCatalogService])
], TenantRouterService);
/** 两点球面距离（km），保留 2 位小数 */
function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 100) / 100;
}
//# sourceMappingURL=tenant-router.service.js.map