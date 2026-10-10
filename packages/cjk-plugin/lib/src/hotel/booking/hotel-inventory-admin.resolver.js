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
exports.HotelInventoryAdminResolver = void 0;
// 房量管理 Admin API（P1 Task 3）：web-admin 房量日历的读写入口
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const hotel_inventory_service_1 = require("./hotel-inventory.service");
let HotelInventoryAdminResolver = class HotelInventoryAdminResolver {
    constructor(inventory) {
        this.inventory = inventory;
    }
    async hotelRoomDays(ctx, variantId, month) {
        return this.inventory.listRoomDays(ctx, variantId, month);
    }
    async setHotelRoomDay(ctx, variantId, date, totalRooms, closed) {
        return this.inventory.upsertRoomDay(ctx, variantId, date, { totalRooms, closed });
    }
    async batchSetHotelRoomDays(ctx, variantId, from, to, totalRooms, closed, weekdays) {
        return this.inventory.batchUpsertRoomDays(ctx, variantId, from, to, { totalRooms, closed, weekdays });
    }
};
exports.HotelInventoryAdminResolver = HotelInventoryAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog, core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantId')),
    __param(2, (0, graphql_1.Args)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], HotelInventoryAdminResolver.prototype, "hotelRoomDays", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantId')),
    __param(2, (0, graphql_1.Args)('date')),
    __param(3, (0, graphql_1.Args)('totalRooms', { nullable: true })),
    __param(4, (0, graphql_1.Args)('closed', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, Number, Boolean]),
    __metadata("design:returntype", Promise)
], HotelInventoryAdminResolver.prototype, "setHotelRoomDay", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantId')),
    __param(2, (0, graphql_1.Args)('from')),
    __param(3, (0, graphql_1.Args)('to')),
    __param(4, (0, graphql_1.Args)('totalRooms', { nullable: true })),
    __param(5, (0, graphql_1.Args)('closed', { nullable: true })),
    __param(6, (0, graphql_1.Args)('weekdays', { type: () => [Number], nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String, Number, Boolean, Array]),
    __metadata("design:returntype", Promise)
], HotelInventoryAdminResolver.prototype, "batchSetHotelRoomDays", null);
exports.HotelInventoryAdminResolver = HotelInventoryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [hotel_inventory_service_1.HotelInventoryService])
], HotelInventoryAdminResolver);
//# sourceMappingURL=hotel-inventory-admin.resolver.js.map