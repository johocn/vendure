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
exports.StockReservationAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const stock_reservation_service_1 = require("./stock-reservation.service");
let StockReservationAdminResolver = class StockReservationAdminResolver {
    constructor(service) {
        this.service = service;
    }
    async reservations(ctx, status, variantId, orderId, page, pageSize) {
        return this.service.list(ctx, { status, variantId, orderId, page, pageSize });
    }
    async reservation(ctx, id) {
        const res = await this.service.get(ctx, Number(id));
        const items = await this.service.items(ctx, Number(id));
        return Object.assign(Object.assign({}, res), { items });
    }
    async reservationReconcile(ctx) {
        return this.service.reconcileScan(ctx);
    }
    async allocateReservation(ctx, id, splits) {
        const res = await this.service.allocate(ctx, Number(id), splits);
        const items = await this.service.items(ctx, Number(id));
        return Object.assign(Object.assign({}, res), { items });
    }
    async fulfillReservationItem(ctx, id, quantity) {
        return this.service.fulfillItem(ctx, Number(id), quantity);
    }
    async releaseReservation(ctx, id) {
        return this.service.release(ctx, Number(id), { returnPhysical: false });
    }
};
exports.StockReservationAdminResolver = StockReservationAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)('variantId', { nullable: true })),
    __param(3, (0, graphql_1.Args)('orderId', { nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 })),
    __param(5, (0, graphql_1.Args)({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], StockReservationAdminResolver.prototype, "reservations", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StockReservationAdminResolver.prototype, "reservation", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], StockReservationAdminResolver.prototype, "reservationReconcile", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)({ name: 'splits', type: () => [Object] })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], StockReservationAdminResolver.prototype, "allocateReservation", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)({ name: 'quantity', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number]),
    __metadata("design:returntype", Promise)
], StockReservationAdminResolver.prototype, "fulfillReservationItem", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StockReservationAdminResolver.prototype, "releaseReservation", null);
exports.StockReservationAdminResolver = StockReservationAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [stock_reservation_service_1.StockReservationService])
], StockReservationAdminResolver);
//# sourceMappingURL=stock-reservation.admin.resolver.js.map