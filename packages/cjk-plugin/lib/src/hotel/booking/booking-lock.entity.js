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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelBookingLock = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 锁房单（房型 × 晚 × 1 间）：占用事实表，不反查订单行。
 * - 一行 = 1 间房 × 1 晚；同一订单行 N 晚 × M 间 = N×M 行 lock
 * - orderLineId 可空：OrderInterceptor 校验阶段（行未创建）先按 orderId 落 hold，
 *   行创建后（建 booking / confirm 时）反查补填
 * - released 行保留作审计，不参与占用统计
 * - 占用口径：status ∈ {hold(未过期), booked}
 */
let HotelBookingLock = class HotelBookingLock extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.HotelBookingLock = HotelBookingLock;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], HotelBookingLock.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], HotelBookingLock.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], HotelBookingLock.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], HotelBookingLock.prototype, "orderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], HotelBookingLock.prototype, "bookingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'hold' }),
    __metadata("design:type", String)
], HotelBookingLock.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Object)
], HotelBookingLock.prototype, "holdExpiresAt", void 0);
exports.HotelBookingLock = HotelBookingLock = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_hotel_booking_lock_order', ['orderId', 'productVariantId']),
    (0, typeorm_1.Index)('idx_hotel_booking_lock_day', ['productVariantId', 'date', 'status']),
    __metadata("design:paramtypes", [Object])
], HotelBookingLock);
//# sourceMappingURL=booking-lock.entity.js.map