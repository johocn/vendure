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
exports.CampusRiderLocation = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/** 骑手位置历史轨迹（P8-4）：实时位置仍写 Order.customFields.riderLat/riderLng 供 C 端跟踪，
 * 本表只做留痕（配送中每 10s 一条，30 天后由调度任务清理）。 */
let CampusRiderLocation = class CampusRiderLocation extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusRiderLocation = CampusRiderLocation;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderLocation.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderLocation.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderLocation.prototype, "riderCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], CampusRiderLocation.prototype, "lat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], CampusRiderLocation.prototype, "lng", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], CampusRiderLocation.prototype, "reportedAt", void 0);
exports.CampusRiderLocation = CampusRiderLocation = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_campus_rider_location_order', ['orderId', 'reportedAt']),
    (0, typeorm_1.Index)('idx_campus_rider_location_rider', ['channelId', 'riderCustomerId', 'reportedAt']),
    __metadata("design:paramtypes", [Object])
], CampusRiderLocation);
//# sourceMappingURL=campus-rider-location.entity.js.map