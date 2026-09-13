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
exports.RoomTemplate = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 房型模板（快照源）：客户在商品变体上应用模板时，
 * 整体深拷贝进变体 customFields hotelRoomConfig，模板后续修改不影响已用商品。
 */
let RoomTemplate = class RoomTemplate extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.RoomTemplate = RoomTemplate;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RoomTemplate.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], RoomTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], RoomTemplate.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], RoomTemplate.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], RoomTemplate.prototype, "coverAssetId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RoomTemplate.prototype, "specs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RoomTemplate.prototype, "defaultRooms", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], RoomTemplate.prototype, "basePriceCent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RoomTemplate.prototype, "priceCalendar", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RoomTemplate.prototype, "longStayDiscount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], RoomTemplate.prototype, "minNights", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 30 }),
    __metadata("design:type", Number)
], RoomTemplate.prototype, "maxNights", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 30 }),
    __metadata("design:type", Number)
], RoomTemplate.prototype, "advanceDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '14:00' }),
    __metadata("design:type", String)
], RoomTemplate.prototype, "checkInTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '12:00' }),
    __metadata("design:type", String)
], RoomTemplate.prototype, "checkOutTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Object)
], RoomTemplate.prototype, "cancelPolicy", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'none' }),
    __metadata("design:type", String)
], RoomTemplate.prototype, "depositType", void 0);
exports.RoomTemplate = RoomTemplate = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], RoomTemplate);
//# sourceMappingURL=room-template.entity.js.map