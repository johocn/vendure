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
exports.StockDocAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
const stock_doc_service_1 = require("./stock-doc.service");
/** 管理端：库存单据（采购/移库/盘库/出库） + 库存流水查询 */
let StockDocAdminResolver = class StockDocAdminResolver {
    constructor(stockDocService) {
        this.stockDocService = stockDocService;
    }
    async createStockDoc(ctx, input) {
        return this.stockDocService.create(ctx, input);
    }
    async stockMovementLedger(ctx, productVariantId, locationId, bizCode, orderLineId, page, pageSize) {
        return this.stockDocService.ledger(ctx, {
            productVariantId,
            locationId,
            bizCode,
            orderLineId,
            page,
            pageSize,
        });
    }
};
exports.StockDocAdminResolver = StockDocAdminResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(inventory_plugin_1.InventoryPermissions.ViewStock),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StockDocAdminResolver.prototype, "createStockDoc", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(inventory_plugin_1.InventoryPermissions.ViewStock),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productVariantId', { nullable: true })),
    __param(2, (0, graphql_1.Args)('locationId', { nullable: true })),
    __param(3, (0, graphql_1.Args)('bizCode', { nullable: true })),
    __param(4, (0, graphql_1.Args)('orderLineId', { nullable: true })),
    __param(5, (0, graphql_1.Args)('page', { nullable: true })),
    __param(6, (0, graphql_1.Args)('pageSize', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, String, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], StockDocAdminResolver.prototype, "stockMovementLedger", null);
exports.StockDocAdminResolver = StockDocAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [stock_doc_service_1.StockDocService])
], StockDocAdminResolver);
//# sourceMappingURL=stock-doc.admin.resolver.js.map