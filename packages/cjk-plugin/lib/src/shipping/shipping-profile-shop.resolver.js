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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingProfileShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shipping_profile_service_1 = require("./shipping-profile.service");
let ShippingProfileShopResolver = class ShippingProfileShopResolver {
    constructor(service) {
        this.service = service;
    }
    async eligibleShippingMethodsByProfile(ctx, profileIds) {
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        const intersected = await this.service.getIntersectedShippingMethods(ctx, profileIds);
        if (intersected.length === 0)
            return [];
        return (await this.service.findShippingMethodsByIds(ctx, intersected.map(m => m.id)))
            .filter((m) => { var _a; return ((_a = m.customFields) === null || _a === void 0 ? void 0 : _a.enabled) !== false; });
    }
    async checkShippingProfileCompatibility(ctx, profileIds) {
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        const methods = await this.service.getIntersectedShippingMethods(ctx, profileIds);
        return {
            compatible: methods.length > 0,
            intersectedCount: methods.length,
        };
    }
    async eligibleShippingMethodsWithConfig(ctx, profileIds) {
        var _a, _b, _c, _d;
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        const intersected = await this.service.getIntersectedShippingMethods(ctx, profileIds);
        if (intersected.length === 0)
            return [];
        const configs = new Map();
        for (const pid of profileIds) {
            const rows = await this.service.getMethodConfigsByProfile(ctx, pid);
            // shippingMethodId 是整数 FK，而 m.id 是 Vendure 字符串 ID，必须双端 String() 化，
            // 否则 Map 键类型不一致导致 mode/pickupLocationIds 恒为 null。
            for (const r of rows)
                configs.set(String(r.shippingMethodId), r);
        }
        const full = await this.service.findShippingMethodsByIds(ctx, intersected.map(m => m.id));
        const enriched = [];
        for (const m of full.filter((m) => { var _a; return ((_a = m.customFields) === null || _a === void 0 ? void 0 : _a.enabled) !== false; })) {
            const cfg = configs.get(String(m.id));
            const pickupIds = cfg && ['pickup', 'store', 'employee'].includes(cfg.mode)
                ? await this.service.getEffectivePickupIdsForConfig(ctx, cfg)
                : null;
            enriched.push({ id: m.id, code: m.code, mode: (_a = cfg === null || cfg === void 0 ? void 0 : cfg.mode) !== null && _a !== void 0 ? _a : null, pickupLocationIds: pickupIds, name: (_d = (_c = (_b = m.translations) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : m.code });
        }
        return enriched;
    }
    async resolveShippingMethodsForChannel(ctx) {
        var _a, _b, _c, _d, _e;
        const def = await this.service.getTenantDefault(ctx);
        if (def) {
            const ids = ((_a = def.shippingMethods) !== null && _a !== void 0 ? _a : []).map(m => m.id);
            const full = await this.service.findShippingMethodsByIds(ctx, ids);
            const configs = await this.service.getMethodConfigsByProfile(ctx, def.id);
            const cm = new Map(configs.map(c => [String(c.shippingMethodId), c]));
            const result = [];
            for (const m of full.filter((m) => { var _a; return ((_a = m.customFields) === null || _a === void 0 ? void 0 : _a.enabled) !== false; })) {
                const cfg = cm.get(String(m.id));
                const pickupIds = cfg && ['pickup', 'store', 'employee'].includes(cfg.mode)
                    ? await this.service.getEffectivePickupIdsForConfig(ctx, cfg)
                    : null;
                result.push({
                    id: m.id, code: m.code,
                    mode: (_b = cfg === null || cfg === void 0 ? void 0 : cfg.mode) !== null && _b !== void 0 ? _b : null,
                    pickupLocationIds: pickupIds,
                    name: (_e = (_d = (_c = m.translations) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : m.code,
                });
            }
            return result;
        }
        // 无默认档案 → 返回当前可见的全部配送方式（沿用 service 既有 findAll 的租户可见过滤）
        const all = await this.service.findShippingMethodsByIds(ctx, (await this.service.findAll(ctx)).items.flatMap(s => { var _a, _b; return (_b = (_a = s.shippingMethods) === null || _a === void 0 ? void 0 : _a.map(sm => sm.id)) !== null && _b !== void 0 ? _b : []; }));
        return all
            .filter((m) => { var _a; return ((_a = m.customFields) === null || _a === void 0 ? void 0 : _a.enabled) !== false; })
            .map((m) => { var _a, _b, _c; return ({ id: m.id, code: m.code, mode: null, pickupLocationIds: null, name: (_c = (_b = (_a = m.translations) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : m.code }); });
    }
    /**
     * 按 Profile 交集查询允许的自提点。
     * 返回值语义：
     * - []  → 所有 Profile 都未约束自提点（前端展示全部），或交集为空（前端展示"无可用"）
     * - [locations] → 交集非空，前端仅展示这些自提点
     * 前端需配合 checkPickupLocationConstraint 查询区分两种 [] 情况
     */
    async eligiblePickupLocationsByProfile(ctx, profileIds) {
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        const ids = await this.service.getIntersectedPickupLocationsWithConfig(ctx, profileIds);
        if (ids === null || ids.length === 0)
            return [];
        return await this.service.findPickupLocationsByIds(ctx, ids);
    }
    async checkPickupLocationConstraint(ctx, profileIds) {
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        return this.service.hasPickupLocationConstraint(ctx, profileIds);
    }
};
exports.ShippingProfileShopResolver = ShippingProfileShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "eligibleShippingMethodsByProfile", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "checkShippingProfileCompatibility", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "eligibleShippingMethodsWithConfig", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "resolveShippingMethodsForChannel", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "eligiblePickupLocationsByProfile", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShippingProfileShopResolver.prototype, "checkPickupLocationConstraint", null);
exports.ShippingProfileShopResolver = ShippingProfileShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [shipping_profile_service_1.ShippingProfileService])
], ShippingProfileShopResolver);
//# sourceMappingURL=shipping-profile-shop.resolver.js.map