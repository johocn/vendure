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
exports.CampusLockerStation = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 智能取餐柜站点（P2-4）：按渠道登记柜机，C 端只读展示柜机位置与取餐指引。
 *
 * 本轮为「接口占位」：不接柜机厂商 SDK，只落站点与格口规模，
 * 后续对接服务商时用 provider + 格口数据补「投柜 / 取柜」回调。
 */
let CampusLockerStation = class CampusLockerStation extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusLockerStation = CampusLockerStation;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusLockerStation.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], CampusLockerStation.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], CampusLockerStation.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: 'self' }),
    __metadata("design:type", String)
], CampusLockerStation.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CampusLockerStation.prototype, "totalCells", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CampusLockerStation.prototype, "availableCells", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], CampusLockerStation.prototype, "openHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CampusLockerStation.prototype, "pickupGuide", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], CampusLockerStation.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CampusLockerStation.prototype, "sort", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], CampusLockerStation.prototype, "createdBy", void 0);
exports.CampusLockerStation = CampusLockerStation = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_campus_locker_channel', ['channelId', 'enabled']),
    __metadata("design:paramtypes", [Object])
], CampusLockerStation);
//# sourceMappingURL=campus-locker.entity.js.map