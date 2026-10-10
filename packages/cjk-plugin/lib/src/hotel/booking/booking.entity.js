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
exports.HotelBooking = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 酒店预订单（P3，per 订单行）：一行酒店订单行 ↔ 一条 booking。
 * - 状态机：pendingDeposit → confirmed（支付事件自动确认）→ checkedIn（核销）→ completed；
 *   分支 cancelled / noShow（均终态）
 * - bookingCode：8 位数字入住码，确认时生成，全局唯一（核销凭码）
 * - cancelDeadlineAt：免费取消截止点（确认时按取消政策 + checkIn 推导固化；P4 取消退款用）
 * - channelToken：创建时的渠道 token（审计冗余；隔离以 productVariantId 全局唯一为准，同 P1 lock）
 * - 日期一律 YYYY-MM-DD varchar（跨库铁律）；时间戳列省略 type + 可选 Date
 */
let HotelBooking = class HotelBooking extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.HotelBooking = HotelBooking;
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 8, nullable: true }),
    __metadata("design:type", Object)
], HotelBooking.prototype, "bookingCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], HotelBooking.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], HotelBooking.prototype, "orderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, nullable: true }),
    __metadata("design:type", Object)
], HotelBooking.prototype, "orderCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], HotelBooking.prototype, "channelToken", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], HotelBooking.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], HotelBooking.prototype, "checkIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], HotelBooking.prototype, "checkOut", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], HotelBooking.prototype, "nights", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], HotelBooking.prototype, "roomCount", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pendingDeposit' }),
    __metadata("design:type", String)
], HotelBooking.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], HotelBooking.prototype, "ratePlanCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], HotelBooking.prototype, "totalCent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], HotelBooking.prototype, "guestName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], HotelBooking.prototype, "guestPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], HotelBooking.prototype, "cancelDeadlineAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], HotelBooking.prototype, "confirmedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], HotelBooking.prototype, "checkedInAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], HotelBooking.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], HotelBooking.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], HotelBooking.prototype, "cancelReason", void 0);
exports.HotelBooking = HotelBooking = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_hotel_booking_order', ['orderId']),
    (0, typeorm_1.Index)('idx_hotel_booking_variant_status', ['productVariantId', 'status']),
    (0, typeorm_1.Index)('idx_hotel_booking_status_dates', ['status', 'checkOut']),
    __metadata("design:paramtypes", [Object])
], HotelBooking);
//# sourceMappingURL=booking.entity.js.map