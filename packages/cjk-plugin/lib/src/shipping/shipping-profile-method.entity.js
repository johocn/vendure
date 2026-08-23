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
exports.ShippingProfileMethod = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 配送档案 × 配送方式 的 join 载荷实体。
 * 存放某一配送方式在某档案下的工作模式（options）。
 * - mode='pickup' → options.pickupLocationIds = 该方式在该档案下允许的自提点集合
 * - mode='mail'   → 范围/运费公式仍留在 Vendure ShippingMethod 实例，options 可选
 */
let ShippingProfileMethod = class ShippingProfileMethod extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ShippingProfileMethod = ShippingProfileMethod;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShippingProfileMethod.prototype, "profileId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShippingProfileMethod.prototype, "shippingMethodId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pickup' }),
    __metadata("design:type", String)
], ShippingProfileMethod.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], ShippingProfileMethod.prototype, "options", void 0);
exports.ShippingProfileMethod = ShippingProfileMethod = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], ShippingProfileMethod);
//# sourceMappingURL=shipping-profile-method.entity.js.map