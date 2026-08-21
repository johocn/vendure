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
exports.DeliveryRange = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 商家配送范围（一店一档）。关联 shop-plugin 的 Shop（shopId）。
 * rangeType: all 不限 / circle 圆心半径(km) / district 省市区白名单。
 * districtCodes 存 JSON 文本数组，跨库安全，服务内 JSON.parse。
 */
let DeliveryRange = class DeliveryRange extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.DeliveryRange = DeliveryRange;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], DeliveryRange.prototype, "shopId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], DeliveryRange.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'all' }),
    __metadata("design:type", String)
], DeliveryRange.prototype, "rangeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], DeliveryRange.prototype, "centerLng", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], DeliveryRange.prototype, "centerLat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], DeliveryRange.prototype, "radiusKm", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DeliveryRange.prototype, "districtCodes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], DeliveryRange.prototype, "baseFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], DeliveryRange.prototype, "freeThreshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], DeliveryRange.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], DeliveryRange.prototype, "channels", void 0);
exports.DeliveryRange = DeliveryRange = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['shopId', 'channelId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], DeliveryRange);
//# sourceMappingURL=delivery-range.entity.js.map