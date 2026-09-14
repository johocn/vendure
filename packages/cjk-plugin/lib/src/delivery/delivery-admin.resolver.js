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
exports.DeliveryAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
const delivery_record_service_1 = require("./delivery-record.service");
let DeliveryAdminResolver = class DeliveryAdminResolver {
    constructor(deliveryRecordService, inventoryService) {
        this.deliveryRecordService = deliveryRecordService;
        this.inventoryService = inventoryService;
    }
    async deliveryRecords(ctx, orderId) {
        return this.deliveryRecordService.findByOrder(ctx, orderId);
    }
    async deliveryTransition(ctx, id, to) {
        return this.deliveryRecordService.transition(ctx, id, to);
    }
    async deliverySetExpress(ctx, id, expressCompany, trackingNo) {
        return this.deliveryRecordService.setExpress(ctx, id, expressCompany, trackingNo);
    }
    async deliveryAssignStaff(ctx, id, staffId, staffName) {
        return this.deliveryRecordService.assignStaff(ctx, id, staffId, staffName);
    }
    async deliveryCreateTransfer(ctx, orderId, fromLocationId, toLocationId, itemsJson) {
        return this.deliveryRecordService.createTransfer(ctx, {
            orderId,
            fromLocationId,
            toLocationId,
            items: JSON.parse(itemsJson),
        });
    }
    async deliveryTransferArrived(ctx, id) {
        return this.deliveryRecordService.markTransferArrived(ctx, id, (c, v, l, d, r, m) => this.inventoryService.adjustStockPublic(c, v, l, d, r, m));
    }
};
exports.DeliveryAdminResolver = DeliveryAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder, core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "deliveryRecords", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "deliveryTransition", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('expressCompany')),
    __param(3, (0, graphql_1.Args)('trackingNo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "deliverySetExpress", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('staffId')),
    __param(3, (0, graphql_1.Args)('staffName', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "deliveryAssignStaff", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('fromLocationId')),
    __param(3, (0, graphql_1.Args)('toLocationId')),
    __param(4, (0, graphql_1.Args)('itemsJson')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "deliveryCreateTransfer", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "deliveryTransferArrived", null);
exports.DeliveryAdminResolver = DeliveryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [delivery_record_service_1.DeliveryRecordService,
        inventory_plugin_1.InventoryService])
], DeliveryAdminResolver);
//# sourceMappingURL=delivery-admin.resolver.js.map