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
exports.StoreLocatorService = exports.STORE_RADIUS_KM = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
/** 门店匹配半径（km） */
exports.STORE_RADIUS_KM = 3;
/** 门店列表最多展示条数 */
const MAX_STORES = 5;
/** 熟店取历史使用次数前 N 家 */
const FAMILIAR_LIMIT = 5;
/**
 * 门店匹配服务（购物助手专用）：
 * - 3km 内门店：取渠道可见的 store 类型自提点 → 坐标校验 → Haversine 距离过滤
 * - 熟店优先：顾客历史订单选过的门店排在 3km 内列表最前，其余按距离升序
 * 所有失败返回空列表，不向上抛错（聊天链路不因门店数据异常中断）。
 */
let StoreLocatorService = class StoreLocatorService {
    constructor(moduleRef, connection) {
        this.moduleRef = moduleRef;
        this.connection = connection;
        this.warned = false;
    }
    getPickupService() {
        if (this.pickupService)
            return this.pickupService;
        try {
            this.pickupService = this.moduleRef.get(cjk_plugin_1.PickupLocationService, { strict: false });
            return this.pickupService;
        }
        catch (e) {
            if (!this.warned) {
                this.warned = true;
                core_2.Logger.warn(`PickupLocationService 不可用，门店匹配降级：${String(e)}`, constants_1.loggerCtx);
            }
            return undefined;
        }
    }
    /** 3km 内门店（熟店优先，其次距离升序）；无门店/数据异常返回空列表 */
    async findNearby(ctx, lat, lng, options = {}) {
        var _a, _b;
        const service = this.getPickupService();
        if (!service)
            return [];
        const radius = (_a = options.radiusKm) !== null && _a !== void 0 ? _a : exports.STORE_RADIUS_KM;
        const familiar = (_b = options.familiarStoreIds) !== null && _b !== void 0 ? _b : new Set();
        let locations;
        try {
            locations = await service.findByType(ctx, 'store');
        }
        catch (e) {
            core_2.Logger.warn(`Assistant store list failed: ${String(e)}`, constants_1.loggerCtx);
            return [];
        }
        return locations
            .filter(l => l.coordinates && isFiniteNumber(l.coordinates.lat) && isFiniteNumber(l.coordinates.lng))
            .map(l => {
            var _a, _b, _c;
            return ({
                id: String(l.id),
                name: l.name,
                address: (_a = l.address) !== null && _a !== void 0 ? _a : '',
                distanceKm: roundKm(haversineKm(lat, lng, Number(l.coordinates.lat), Number(l.coordinates.lng))),
                familiar: familiar.has(String(l.id)),
                phoneNumber: (_b = l.phoneNumber) !== null && _b !== void 0 ? _b : null,
                businessHours: (_c = l.businessHours) !== null && _c !== void 0 ? _c : null,
            });
        })
            .filter(store => store.distanceKm <= radius)
            .sort((a, b) => Number(b.familiar) - Number(a.familiar) || a.distanceKm - b.distanceKm)
            .slice(0, MAX_STORES);
    }
    /** 按 id 回查门店客服联系方式（复检渠道可见性，避免跨租户取到别家门店电话） */
    async findContact(ctx, storeId) {
        var _a, _b, _c;
        const service = this.getPickupService();
        if (!service)
            return null;
        try {
            const store = await service.findOne(ctx, storeId);
            if (!store || store.enabled === false || store.type !== 'store')
                return null;
            if (!isVisibleToChannel(store, ctx))
                return null;
            return {
                id: String(store.id),
                name: store.name,
                address: (_a = store.address) !== null && _a !== void 0 ? _a : '',
                phoneNumber: (_b = store.phoneNumber) !== null && _b !== void 0 ? _b : null,
                businessHours: (_c = store.businessHours) !== null && _c !== void 0 ? _c : null,
            };
        }
        catch (e) {
            core_2.Logger.warn(`Assistant store contact failed: ${String(e)}`, constants_1.loggerCtx);
            return null;
        }
    }
    /** 顾客历史订单选过的门店 id（按使用次数降序），用于「熟店优先」 */
    async familiarStoreIds(ctx, customerId) {
        if (!customerId)
            return new Set();
        try {
            // relation 自定义字段（selectedPickupLocationId）不随实体加载，用 join 读取 id
            const rows = await this.connection
                .getRepository(ctx, core_2.Order)
                .createQueryBuilder('o')
                .leftJoin('o.customFields.selectedPickupLocationId', 'pl')
                .select('pl.id', 'storeId')
                .addSelect('COUNT(o.id)', 'cnt')
                .where('o.customerId = :customerId', { customerId: String(customerId) })
                .andWhere('pl.id IS NOT NULL')
                .groupBy('pl.id')
                .orderBy('cnt', 'DESC')
                .limit(FAMILIAR_LIMIT)
                .getRawMany();
            return new Set(rows.map(row => String(row.storeId)));
        }
        catch (e) {
            core_2.Logger.warn(`Assistant familiar store query failed: ${String(e)}`, constants_1.loggerCtx);
            return new Set();
        }
    }
};
exports.StoreLocatorService = StoreLocatorService;
exports.StoreLocatorService = StoreLocatorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ModuleRef,
        core_2.TransactionalConnection])
], StoreLocatorService);
function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
}
/** 复刻 PickupLocationService 的可见规则（平台全可见；租户限公共/自建且已关联渠道） */
function isVisibleToChannel(store, ctx) {
    var _a, _b, _c, _d;
    if (String((_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : '') === '__default_channel__')
        return true;
    const ownedOrPublic = store.isPublic === true || String((_c = store.ownerChannelId) !== null && _c !== void 0 ? _c : '') === String(ctx.channelId);
    if (!ownedOrPublic)
        return false;
    return ((_d = store.channels) !== null && _d !== void 0 ? _d : []).some((channel) => String(channel.id) === String(ctx.channelId));
}
function roundKm(value) {
    return Math.round(value * 10) / 10;
}
/** Haversine 直线距离（km） */
function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}
//# sourceMappingURL=store-locator.service.js.map