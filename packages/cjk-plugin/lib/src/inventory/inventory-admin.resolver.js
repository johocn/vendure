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
exports.InventoryAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
const virtual_physical_stock_service_1 = require("./virtual-physical-stock.service");
/** 管理端库存配置：变体 × 物理仓绑定（物理驱动变体由此开启）+ 租户库存仓管理 */
let InventoryAdminResolver = class InventoryAdminResolver {
    constructor(virtualPhysicalStockService) {
        this.virtualPhysicalStockService = virtualPhysicalStockService;
    }
    async setVariantBindings(ctx, variantId, bindings) {
        return this.virtualPhysicalStockService.setVariantBindings(ctx, variantId, bindings);
    }
    /** 租户库存方案概览（开关口径 + 系统仓落点 + 仓清单） */
    async tenantInventoryOverview(ctx) {
        return this.virtualPhysicalStockService.getTenantInventoryOverview(ctx);
    }
    /** 幂等补建系统仓（虚拟仓恒在；开关开启时补默认物理仓），供后台「一键初始化」与自愈 */
    async ensureTenantInventoryLocations(ctx) {
        return this.virtualPhysicalStockService.ensureTenantInventoryLocations(ctx);
    }
    /** 新建租户物理仓（服务端自动编码 + 归属校验 + 强制 physical） */
    async createTenantStockLocation(ctx, input) {
        return this.virtualPhysicalStockService.createTenantPhysicalLocation(ctx, input);
    }
    /** 更新租户仓（名称/配送方式/服务城市/坐标；编码与性质不可改） */
    async updateTenantStockLocation(ctx, input) {
        return this.virtualPhysicalStockService.updateTenantPhysicalLocation(ctx, input);
    }
    /** 删除租户仓（系统仓不可删） */
    async deleteTenantStockLocation(ctx, id) {
        return this.virtualPhysicalStockService.deleteTenantPhysicalLocation(ctx, id);
    }
};
exports.InventoryAdminResolver = InventoryAdminResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(inventory_plugin_1.InventoryPermissions.ViewStock),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantId')),
    __param(2, (0, graphql_1.Args)('bindings')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "setVariantBindings", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog, core_1.Permission.ReadStockLocation),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "tenantInventoryOverview", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.CreateStockLocation, core_1.Permission.UpdateStockLocation),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "ensureTenantInventoryLocations", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.CreateStockLocation),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "createTenantStockLocation", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateStockLocation),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "updateTenantStockLocation", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.DeleteStockLocation),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "deleteTenantStockLocation", null);
exports.InventoryAdminResolver = InventoryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [virtual_physical_stock_service_1.VirtualPhysicalStockService])
], InventoryAdminResolver);
//# sourceMappingURL=inventory-admin.resolver.js.map