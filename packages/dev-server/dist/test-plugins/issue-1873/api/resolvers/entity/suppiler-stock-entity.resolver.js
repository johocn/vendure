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
exports.SupplierStockEntityResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const supplier_stock_entity_1 = require("../../../entities/supplier-stock.entity");
let SupplierStockEntityResolver = class SupplierStockEntityResolver {
    constructor(productVariantService) {
        this.productVariantService = productVariantService;
    }
    async productVariant(supplierStock, ctx) {
        return (0, core_1.assertFound)(this.productVariantService.findOne(ctx, supplierStock.productVariantId));
    }
};
exports.SupplierStockEntityResolver = SupplierStockEntityResolver;
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supplier_stock_entity_1.SupplierStock,
        core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], SupplierStockEntityResolver.prototype, "productVariant", null);
exports.SupplierStockEntityResolver = SupplierStockEntityResolver = __decorate([
    (0, graphql_1.Resolver)('SupplierStock'),
    __metadata("design:paramtypes", [core_1.ProductVariantService])
], SupplierStockEntityResolver);
//# sourceMappingURL=suppiler-stock-entity.resolver.js.map