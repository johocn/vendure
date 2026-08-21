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
exports.DeliveryAddress = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 顾客收货地址（中国化字段：省市区 + 详细地址 + 经纬度）。
 * 按 customerId 强隔离；isDefault 同顾客唯一。
 */
let DeliveryAddress = class DeliveryAddress extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.DeliveryAddress = DeliveryAddress;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], DeliveryAddress.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], DeliveryAddress.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], DeliveryAddress.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DeliveryAddress.prototype, "province", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DeliveryAddress.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DeliveryAddress.prototype, "district", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DeliveryAddress.prototype, "provinceCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DeliveryAddress.prototype, "cityCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DeliveryAddress.prototype, "districtCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DeliveryAddress.prototype, "detail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], DeliveryAddress.prototype, "lng", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], DeliveryAddress.prototype, "lat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], DeliveryAddress.prototype, "isDefault", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], DeliveryAddress.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], DeliveryAddress.prototype, "channels", void 0);
exports.DeliveryAddress = DeliveryAddress = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['customerId', 'isDefault']),
    __metadata("design:paramtypes", [Object])
], DeliveryAddress);
//# sourceMappingURL=delivery-address.entity.js.map