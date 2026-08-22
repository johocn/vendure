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
const constants_1 = require("./constants");
const inventory_service_1 = require("./inventory.service");
let InventoryAdminResolver = class InventoryAdminResolver {
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    // ===== 库存查询 =====
    async stockLevels(ctx, locationId, page, pageSize) {
        return this.inventoryService.findStockLevels(ctx, { locationId, page, pageSize });
    }
    async setVariantStock(ctx, productVariantId, stockLocationId, stockOnHand) {
        await this.inventoryService.setStockForVariant(ctx, productVariantId, stockLocationId, stockOnHand);
        return true;
    }
    async stockMovements(ctx, productVariantId, locationId, type, page, pageSize) {
        return this.inventoryService.findStockMovements(ctx, { productVariantId, locationId, type, page, pageSize });
    }
    async stockLedger(ctx, productVariantId, locationId, bizType, bizCode, orderLineId, page, pageSize) {
        return this.inventoryService.findStockLedger(ctx, {
            productVariantId, locationId, bizType, bizCode, orderLineId, page, pageSize,
        });
    }
    // ===== 入库单 =====
    async stockInOrders(ctx, state, page, pageSize) {
        return this.inventoryService.findStockInOrders(ctx, { state, page, pageSize });
    }
    async stockInOrder(ctx, id) {
        return this.inventoryService.findOneStockInOrder(ctx, id);
    }
    async createStockInOrder(ctx, input) {
        return this.inventoryService.createStockInOrder(ctx, input);
    }
    async completeStockInOrder(ctx, id) {
        return this.inventoryService.completeStockInOrder(ctx, id);
    }
    async cancelStockInOrder(ctx, id) {
        return this.inventoryService.cancelStockInOrder(ctx, id);
    }
    // ===== 出库单 =====
    async stockOutOrders(ctx, state, page, pageSize) {
        return this.inventoryService.findStockOutOrders(ctx, { state, page, pageSize });
    }
    async stockOutOrder(ctx, id) {
        return this.inventoryService.findOneStockOutOrder(ctx, id);
    }
    async createStockOutOrder(ctx, input) {
        return this.inventoryService.createStockOutOrder(ctx, input);
    }
    async completeStockOutOrder(ctx, id) {
        return this.inventoryService.completeStockOutOrder(ctx, id);
    }
    async cancelStockOutOrder(ctx, id) {
        return this.inventoryService.cancelStockOutOrder(ctx, id);
    }
    // ===== 调拨单 =====
    async stockMoveOrders(ctx, state, page, pageSize) {
        return this.inventoryService.findStockMoveOrders(ctx, { state, page, pageSize });
    }
    async stockMoveOrder(ctx, id) {
        return this.inventoryService.findOneStockMoveOrder(ctx, id);
    }
    async createStockMoveOrder(ctx, input) {
        return this.inventoryService.createStockMoveOrder(ctx, input);
    }
    async shipStockMoveOrder(ctx, id) {
        return this.inventoryService.shipStockMoveOrder(ctx, id);
    }
    async receiveStockMoveOrder(ctx, id) {
        return this.inventoryService.receiveStockMoveOrder(ctx, id);
    }
    async completeStockMoveOrder(ctx, id) {
        return this.inventoryService.completeStockMoveOrder(ctx, id);
    }
    async cancelStockMoveOrder(ctx, id) {
        return this.inventoryService.cancelStockMoveOrder(ctx, id);
    }
    // ===== 盘点单 =====
    async stocktakeOrders(ctx, state, page, pageSize) {
        return this.inventoryService.findStocktakeOrders(ctx, { state, page, pageSize });
    }
    async stocktakeOrder(ctx, id) {
        return this.inventoryService.findOneStocktakeOrder(ctx, id);
    }
    async createStocktakeOrder(ctx, input) {
        return this.inventoryService.createStocktakeOrder(ctx, input);
    }
    async startCountingStocktake(ctx, id) {
        return this.inventoryService.startCountingStocktake(ctx, id);
    }
    async submitStocktakeCount(ctx, id, counts) {
        return this.inventoryService.submitStocktakeCount(ctx, id, counts);
    }
    async reconcileStocktakeLine(ctx, orderId, lineId) {
        return this.inventoryService.reconcileStocktakeLine(ctx, orderId, lineId);
    }
    async completeStocktakeOrder(ctx, id) {
        return this.inventoryService.completeStocktakeOrder(ctx, id);
    }
    async cancelStocktakeOrder(ctx, id) {
        return this.inventoryService.cancelStocktakeOrder(ctx, id);
    }
    // ===== 供应商 =====
    async suppliers(ctx, keyword, options) {
        var _a, _b;
        const page = (options === null || options === void 0 ? void 0 : options.skip) != null ? Math.floor(options.skip / ((_a = options.take) !== null && _a !== void 0 ? _a : 20)) + 1 : 1;
        return this.inventoryService.findSuppliers(ctx, { keyword, page, pageSize: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20 });
    }
    async supplier(ctx, id) {
        return this.inventoryService.findOneSupplier(ctx, id);
    }
    async createSupplier(ctx, input) {
        return this.inventoryService.createSupplier(ctx, input);
    }
    async updateSupplier(ctx, id, input) {
        return this.inventoryService.updateSupplier(ctx, id, input);
    }
    async deleteSupplier(ctx, id) {
        return this.inventoryService.deleteSupplier(ctx, id);
    }
    // ===== 采购单 =====
    async purchaseOrders(ctx, state, options) {
        var _a, _b;
        const page = (options === null || options === void 0 ? void 0 : options.skip) != null ? Math.floor(options.skip / ((_a = options.take) !== null && _a !== void 0 ? _a : 20)) + 1 : 1;
        return this.inventoryService.findPurchaseOrders(ctx, { state, page, pageSize: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20 });
    }
    async purchaseOrder(ctx, id) {
        return this.inventoryService.findOnePurchaseOrder(ctx, id);
    }
    async createPurchaseOrder(ctx, input) {
        return this.inventoryService.createPurchaseOrder(ctx, input);
    }
    async placePurchaseOrder(ctx, id) {
        return this.inventoryService.placePurchaseOrder(ctx, id);
    }
    async receivePurchaseOrder(ctx, id, lines) {
        return this.inventoryService.receivePurchaseOrder(ctx, id, lines);
    }
    async completePurchaseOrder(ctx, id) {
        return this.inventoryService.completePurchaseOrder(ctx, id);
    }
    async cancelPurchaseOrder(ctx, id) {
        return this.inventoryService.cancelPurchaseOrder(ctx, id);
    }
};
exports.InventoryAdminResolver = InventoryAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ViewStock),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'locationId', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 })),
    __param(3, (0, graphql_1.Args)({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stockLevels", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ViewStock),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'productVariantId', type: () => String })),
    __param(2, (0, graphql_1.Args)({ name: 'stockLocationId', type: () => String })),
    __param(3, (0, graphql_1.Args)({ name: 'stockOnHand', type: () => Number })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Number]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "setVariantStock", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ViewStock),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'productVariantId', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'locationId', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'type', type: () => String, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 })),
    __param(5, (0, graphql_1.Args)({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, String, Number, Number]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stockMovements", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ViewStock),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'productVariantId', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'locationId', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'bizType', type: () => String, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'bizCode', type: () => String, nullable: true })),
    __param(5, (0, graphql_1.Args)({ name: 'orderLineId', type: () => String, nullable: true })),
    __param(6, (0, graphql_1.Args)({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 })),
    __param(7, (0, graphql_1.Args)({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, String, String, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stockLedger", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockIn),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'state', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 })),
    __param(3, (0, graphql_1.Args)({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stockInOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockIn),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stockInOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockIn),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "createStockInOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockIn),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "completeStockInOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockIn),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "cancelStockInOrder", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockOut),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'state', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 })),
    __param(3, (0, graphql_1.Args)({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stockOutOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockOut),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stockOutOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockOut),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "createStockOutOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockOut),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "completeStockOutOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockOut),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "cancelStockOutOrder", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockMove),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'state', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 })),
    __param(3, (0, graphql_1.Args)({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stockMoveOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockMove),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stockMoveOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockMove),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "createStockMoveOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockMove),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "shipStockMoveOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockMove),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "receiveStockMoveOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockMove),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "completeStockMoveOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStockMove),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "cancelStockMoveOrder", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStocktake),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'state', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 })),
    __param(3, (0, graphql_1.Args)({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stocktakeOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStocktake),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "stocktakeOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStocktake),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "createStocktakeOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStocktake),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "startCountingStocktake", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStocktake),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('counts')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "submitStocktakeCount", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStocktake),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('lineId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "reconcileStocktakeLine", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStocktake),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "completeStocktakeOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageStocktake),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "cancelStocktakeOrder", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageSupplier),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'keyword', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'options', type: () => Object, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "suppliers", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageSupplier),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "supplier", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageSupplier),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "createSupplier", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageSupplier),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "updateSupplier", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManageSupplier),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "deleteSupplier", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManagePurchase),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'state', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'options', type: () => Object, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "purchaseOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManagePurchase),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "purchaseOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManagePurchase),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "createPurchaseOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManagePurchase),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "placePurchaseOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManagePurchase),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('lines')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "receivePurchaseOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManagePurchase),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "completePurchaseOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.InventoryPermissions.ManagePurchase),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryAdminResolver.prototype, "cancelPurchaseOrder", null);
exports.InventoryAdminResolver = InventoryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryAdminResolver);
