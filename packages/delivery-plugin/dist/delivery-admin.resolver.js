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
const constants_1 = require("./constants");
const delivery_service_1 = require("./delivery.service");
/**
 * @description
 * Admin API resolver：送货任务的查询与状态流转。
 *
 * 设计说明：
 * - `myDeliveries` 仅返回 `ctx.activeUserId` 名下的订单；`allDeliveries` 返回全部。
 * - 各 mutation 通过 `@Allow` 限制权限，service 内部再校验 ownership。
 * - 返回类型复用 Vendure 内置 `Order`，customFields 中的 delivery* 字段自动暴露。
 */
let DeliveryAdminResolver = class DeliveryAdminResolver {
    constructor(deliveryService) {
        this.deliveryService = deliveryService;
    }
    async allDeliveries(ctx, status) {
        return this.deliveryService.findAllDeliveries(ctx, status);
    }
    async myDeliveries(ctx, status) {
        if (!ctx.activeUserId) {
            return [];
        }
        return this.deliveryService.findMyDeliveries(ctx, String(ctx.activeUserId), status);
    }
    async startDelivery(ctx, orderId) {
        return this.deliveryService.startDelivery(ctx, orderId);
    }
    async markDelivered(ctx, orderId, photos, note) {
        return this.deliveryService.markDelivered(ctx, orderId, photos, note);
    }
    async confirmPickupHandover(ctx, orderId) {
        return this.deliveryService.confirmPickupHandover(ctx, orderId);
    }
    async reportException(ctx, orderId, type, photos, note) {
        return this.deliveryService.reportException(ctx, orderId, type, photos, note);
    }
    async reassignDelivery(ctx, orderId, newStaffId) {
        return this.deliveryService.reassignDelivery(ctx, orderId, String(newStaffId));
    }
};
exports.DeliveryAdminResolver = DeliveryAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.DeliveryPermissions.ViewAllDeliveries),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "allDeliveries", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.DeliveryPermissions.DeliverOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "myDeliveries", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.DeliveryPermissions.DeliverOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "startDelivery", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.DeliveryPermissions.MarkDelivered),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)({ name: 'photos', type: () => [String] })),
    __param(3, (0, graphql_1.Args)({ name: 'note', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array, String]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "markDelivered", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.DeliveryPermissions.MarkDelivered),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "confirmPickupHandover", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.DeliveryPermissions.ReportException),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)({ name: 'type', type: () => String })),
    __param(3, (0, graphql_1.Args)({ name: 'photos', type: () => [String] })),
    __param(4, (0, graphql_1.Args)({ name: 'note', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, Array, String]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "reportException", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.DeliveryPermissions.ReassignDelivery),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('newStaffId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryAdminResolver.prototype, "reassignDelivery", null);
exports.DeliveryAdminResolver = DeliveryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [delivery_service_1.DeliveryService])
], DeliveryAdminResolver);
