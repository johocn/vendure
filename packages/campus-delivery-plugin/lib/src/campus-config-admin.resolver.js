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
const merchant_admin_service_1 = require("./merchant-admin.service");
const permissions_1 = require("./permissions");
const shipping_profile_ensure_service_1 = require("./shipping-profile-ensure.service");
const waimai_store_service_1 = require("./waimai-store.service");
let CampusConfigAdminResolver = class CampusConfigAdminResolver {
    constructor(config, errand, stores, profileEnsure, merchant) {
        this.config = config;
        this.errand = errand;
        this.stores = stores;
        this.profileEnsure = profileEnsure;
        this.merchant = merchant;
    }
    async campusZones(ctx) {
        return this.config.listZones(ctx);
    }
    async campusBuildings(ctx, zoneId) {
        return this.config.listBuildings(ctx, zoneId != null ? Number(zoneId) : undefined);
    }
    async campusConfig(ctx) {
        return this.config.getConfig(ctx);
    }
    async campusCreateZone(ctx, name, fee) {
        return this.config.createZone(ctx, name, fee);
    }
    async campusUpdateZone(ctx, id, name, fee) {
        return this.config.updateZone(ctx, Number(id), { name, fee });
    }
    async campusDeleteBuilding(ctx, id) {
        return this.config.deleteBuilding(ctx, Number(id));
    }
    async campusCreateBuilding(ctx, name, zoneId, detail, lat, lng) {
        return this.config.createBuilding(ctx, name, Number(zoneId), detail, lat, lng);
    }
    async campusUpdateBuilding(ctx, id, input) {
        return this.config.updateBuilding(ctx, Number(id), input);
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
    /** 运营中心推送/重推外部快递（R2 待推送、R3 外部策略；复用商家侧同源实现，带渠道归属校验） */
    async campusAdminDispatchExternal(ctx, orderId, provider) {
        return this.merchant.dispatchExternal(ctx, orderId, provider);
    }
    /** 运营中心取消外部快递（换一家重推前，或运力失败回落大厅） */
    async campusAdminCancelExternal(ctx, orderId, reason) {
        return this.merchant.cancelExternal(ctx, orderId, reason);
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
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)({ name: 'name', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'fee', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, Number]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusUpdateZone", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusDeleteBuilding", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('name')),
    __param(2, (0, graphql_1.Args)('zoneId')),
    __param(3, (0, graphql_1.Args)('detail', { nullable: true })),
    __param(4, (0, graphql_1.Args)('lat', { nullable: true, type: () => Number })),
    __param(5, (0, graphql_1.Args)('lng', { nullable: true, type: () => Number })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object, String, Number, Number]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusCreateBuilding", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusUpdateBuilding", null);
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
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('provider')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusAdminDispatchExternal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)({ name: 'reason', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], CampusConfigAdminResolver.prototype, "campusAdminCancelExternal", null);
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
        shipping_profile_ensure_service_1.ShippingProfileEnsureService,
        merchant_admin_service_1.MerchantAdminService])
], CampusConfigAdminResolver);
//# sourceMappingURL=campus-config-admin.resolver.js.map