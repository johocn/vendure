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
exports.HotelRoomDay = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 房量日历（房型 × 逐日）：P1 防超订的房量事实表。
 * - 无行时回退变体 hotelRoomConfig.totalRooms；两者都无 → 不限房（沿用既有行为）
 * - date 为入住当晚归属（date-only 字符串，跨库铁律：varchar 存 YYYY-MM-DD，不用日期列）
 */
let HotelRoomDay = class HotelRoomDay extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.HotelRoomDay = HotelRoomDay;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], HotelRoomDay.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], HotelRoomDay.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], HotelRoomDay.prototype, "totalRooms", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], HotelRoomDay.prototype, "closed", void 0);
exports.HotelRoomDay = HotelRoomDay = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('uk_hotel_room_day', ['productVariantId', 'date'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], HotelRoomDay);
//# sourceMappingURL=room-day.entity.js.map