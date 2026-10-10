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
exports.HotelBookingAdminResolver = void 0;
// 酒店预订单 Admin API（P3 Task 11）：商家端预订管理页（Task 13）读写入口
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const booking_service_1 = require("./booking.service");
let HotelBookingAdminResolver = class HotelBookingAdminResolver {
    constructor(bookingService) {
        this.bookingService = bookingService;
    }
    async hotelBookings(ctx, filter) {
        return this.bookingService.listForAdmin(ctx, filter !== null && filter !== void 0 ? filter : {});
    }
    /** 到店核销：凭 8 位入住码（扫码/输码同一入口）；仅 confirmed 且当日 ∈ [checkIn, checkOut) */
    async hotelBookingCheckIn(ctx, code) {
        var _a;
        try {
            return await this.bookingService.checkIn(ctx, { code });
        }
        catch (e) {
            throw new core_1.UserInputError((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : 'CHECK_IN_FAILED');
        }
    }
    /** 手动完成离店（日常定时任务会兜底自动完成） */
    async hotelBookingComplete(ctx, id) {
        var _a;
        try {
            return await this.bookingService.complete(ctx, id);
        }
        catch (e) {
            throw new core_1.UserInputError((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : 'COMPLETE_FAILED');
        }
    }
    /** 强制取消（pendingDeposit/confirmed → cancelled 并释放锁房；退款走 Task 14 售后单） */
    async hotelBookingForceCancel(ctx, id, reason) {
        var _a;
        try {
            return await this.bookingService.forceCancel(ctx, id, reason);
        }
        catch (e) {
            throw new core_1.UserInputError((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : 'FORCE_CANCEL_FAILED');
        }
    }
};
exports.HotelBookingAdminResolver = HotelBookingAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog, core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('filter', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], HotelBookingAdminResolver.prototype, "hotelBookings", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], HotelBookingAdminResolver.prototype, "hotelBookingCheckIn", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], HotelBookingAdminResolver.prototype, "hotelBookingComplete", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('reason', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], HotelBookingAdminResolver.prototype, "hotelBookingForceCancel", null);
exports.HotelBookingAdminResolver = HotelBookingAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [booking_service_1.HotelBookingService])
], HotelBookingAdminResolver);
//# sourceMappingURL=booking-admin.resolver.js.map