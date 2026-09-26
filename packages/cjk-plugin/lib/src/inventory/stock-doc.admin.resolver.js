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
/** 管理端：库存单据（采购/移库/盘库/出库） + 库存流水查询 + 单据中心列表 */
let StockDocAdminResolver = class StockDocAdminResolver {
    constructor(stockDocService) {
        this.stockDocService = stockDocService;
    }
    async createStockDoc(ctx, input) {
        return this.stockDocService.create(ctx, input);
    }
    async stockMovementLedger(ctx, productVariantId, locationId, bizCode, orderLineId, bizType, direction, from, to, page, pageSize) {
        return this.stockDocService.ledger(ctx, {
            productVariantId,
            locationId,
            bizCode,
            orderLineId,
            bizType,
            direction,
            from,
            to,
            page,
            pageSize,
        });
    }
    async stockDocList(ctx, type, locationId, from, to, operator, page, pageSize) {
        return this.stockDocService.listDocs(ctx, { type, locationId, from, to, operator, page, pageSize });
    }
    /** 作业员明细聚合（D46）：服务端 GROUP BY 操作人，绕开 listDocs 的 pageSize ≤ 100 硬上限 */
    async stockDocOperatorStats(ctx, from, to) {
        return this.stockDocService.operatorStats(ctx, { from, to });
    }
};
exports.StockDocAdminResolver = StockDocAdminResolver;
__decorate([
    (0, graphql_1.Mutation)()
    // 租户管理员角色由后台自行配置权限，通常持有 UpdateStockLocation 而未必有 ViewStock，
    // 故与仓库管理保持同一口径（任一命中即可），避免租户侧单据功能被整体拦截。
    ,
    (0, core_1.Allow)(inventory_plugin_1.InventoryPermissions.ViewStock, core_1.Permission.UpdateStockLocation),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StockDocAdminResolver.prototype, "createStockDoc", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(inventory_plugin_1.InventoryPermissions.ViewStock, core_1.Permission.ReadCatalog, core_1.Permission.ReadStockLocation),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productVariantId', { nullable: true })),
    __param(2, (0, graphql_1.Args)('locationId', { nullable: true })),
    __param(3, (0, graphql_1.Args)('bizCode', { nullable: true })),
    __param(4, (0, graphql_1.Args)('orderLineId', { nullable: true })),
    __param(5, (0, graphql_1.Args)('bizType', { nullable: true })),
    __param(6, (0, graphql_1.Args)('direction', { nullable: true })),
    __param(7, (0, graphql_1.Args)('from', { nullable: true })),
    __param(8, (0, graphql_1.Args)('to', { nullable: true })),
    __param(9, (0, graphql_1.Args)('page', { nullable: true })),
    __param(10, (0, graphql_1.Args)('pageSize', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, String, Object, String, String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], StockDocAdminResolver.prototype, "stockMovementLedger", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(inventory_plugin_1.InventoryPermissions.ViewStock, core_1.Permission.ReadCatalog, core_1.Permission.ReadStockLocation),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('type', { nullable: true })),
    __param(2, (0, graphql_1.Args)('locationId', { nullable: true })),
    __param(3, (0, graphql_1.Args)('from', { nullable: true })),
    __param(4, (0, graphql_1.Args)('to', { nullable: true })),
    __param(5, (0, graphql_1.Args)('operator', { nullable: true })),
    __param(6, (0, graphql_1.Args)('page', { nullable: true })),
    __param(7, (0, graphql_1.Args)('pageSize', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object, String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], StockDocAdminResolver.prototype, "stockDocList", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(inventory_plugin_1.InventoryPermissions.ViewStock, core_1.Permission.ReadCatalog, core_1.Permission.ReadStockLocation),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('from', { nullable: true })),
    __param(2, (0, graphql_1.Args)('to', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], StockDocAdminResolver.prototype, "stockDocOperatorStats", null);
exports.StockDocAdminResolver = StockDocAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [stock_doc_service_1.StockDocService])
], StockDocAdminResolver);
//# sourceMappingURL=stock-doc.admin.resolver.js.map