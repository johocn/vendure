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
exports.CampusConfigAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const campus_config_service_1 = require("./campus-config.service");
const errand_service_1 = require("./errand.service");
const permissions_1 = require("./permissions");
const shipping_profile_ensure_service_1 = require("./shipping-profile-ensure.service");
const waimai_store_service_1 = require("./waimai-store.service");
let CampusConfigAdminResolver = class CampusConfigAdminResolver {
    constructor(config, errand, stores, profileEnsure) {
        this.config = config;
        this.errand = errand;
        this.stores = stores;
        this.profileEnsure = profileEnsure;
    }
    async campusZones(ctx) {
        return this.config.listZones(ctx);
    }
    async campusBuildings(ctx, zoneId) {
        return this.config.listBuildings(zoneId != null ? Number(zoneId) : undefined);
    }
    async campusConfig(ctx) {
        return this.config.getConfig(ctx);
    }
    async campusCreateZone(ctx, name, fee) {
        return this.config.createZone(ctx, name, fee);
    }
    async campusCreateBuilding(ctx, name, zoneId, detail) {
        return this.config.createBuilding(ctx, name, Number(zoneId), detail);
    }
    async campusUpdateConfig(ctx, input) {
        return this.config.updateConfig(ctx, input);
    }
    async campusCreateSlot(ctx, input) {
        return this.config.createSlot(ctx, input);
    }
    async campusUpdateSlot(ctx, id, input) {
        return this.config.updateSlot(ctx, id, input);
    }
    async campusSlots(ctx) {
        return this.config.listSlots(ctx);
    }
    /** R5 跑腿单：幂等创建 0 元载体商品（SKU 查重），C 端 addItemToOrder 用其 variantId */
    async campusEnsureErrandProducts(ctx) {
        const { variantId, sku } = await this.errand.ensureErrandProduct(ctx);
        return { variantId, sku };
    }
    /** 拾光达店铺配置：全店铺列表（跨租户视角） */
    async campusStoreConfigs(ctx) {
        return this.stores.listStoreConfigs(ctx);
    }
    async campusUpdateStoreConfig(ctx, channelId, input) {
        return this.stores.updateStoreConfig(ctx, Number(channelId), input);
    }
    /** R2/R4 档案冲突治本：get-or-create 渠道合并默认配送档案（store-pickup+courier-delivery）并补绑未绑档案变体 */
    async campusEnsureDefaultShippingProfile(ctx, channelId) {
        return this.profileEnsure.ensureDefaultShippingProfile(ctx, Number(channelId));
    }
};
exports.CampusConfigAdminResolver = CampusConfigAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusZones", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'zoneId', nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusBuildings", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusConfig", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('name')),
    __param(2, (0, graphql_1.Args)('fee')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusCreateZone", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('name')),
    __param(2, (0, graphql_1.Args)('zoneId')),
    __param(3, (0, graphql_1.Args)('detail', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object, String]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusCreateBuilding", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusUpdateConfig", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusCreateSlot", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Object]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusUpdateSlot", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusSlots", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusEnsureErrandProducts", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusStoreConfigs", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('channelId')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusUpdateStoreConfig", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusEnsureDefaultShippingProfile", null);
exports.CampusConfigAdminResolver = CampusConfigAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [campus_config_service_1.CampusConfigService,
        errand_service_1.ErrandService,
        waimai_store_service_1.WaimaiStoreService,
        shipping_profile_ensure_service_1.ShippingProfileEnsureService])
], CampusConfigAdminResolver);
//# sourceMappingURL=campus-config-admin.resolver.js.map