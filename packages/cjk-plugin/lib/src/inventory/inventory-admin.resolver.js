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
/** 管理端库存配置：变体 × 物理仓绑定（物理驱动变体由此开启） */
let InventoryAdminResolver = class InventoryAdminResolver {
    constructor(virtualPhysicalStockService) {
        this.virtualPhysicalStockService = virtualPhysicalStockService;
    }
    async setVariantBindings(ctx, variantId, bindings) {
        return this.virtualPhysicalStockService.setVariantBindings(ctx, variantId, bindings);
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
exports.InventoryAdminResolver = InventoryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [virtual_physical_stock_service_1.VirtualPhysicalStockService])
], InventoryAdminResolver);
//# sourceMappingURL=inventory-admin.resolver.js.map