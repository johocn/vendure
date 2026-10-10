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
exports.PointsProduct = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/** 积分商品：引用 core 商品/变体 + 兑换配置（积分价按变体生效，同秒杀价口径） */
let PointsProduct = class PointsProduct extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PointsProduct = PointsProduct;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PointsProduct.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PointsProduct.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PointsProduct.prototype, "pointsPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PointsProduct.prototype, "cashPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'physical' }),
    __metadata("design:type", String)
], PointsProduct.prototype, "deliveryType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PointsProduct.prototype, "stock", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PointsProduct.prototype, "perUserLimit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PointsProduct.prototype, "redeemedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date, nullable: true }),
    __metadata("design:type", Object)
], PointsProduct.prototype, "validFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date, nullable: true }),
    __metadata("design:type", Object)
], PointsProduct.prototype, "validTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'enabled' }),
    __metadata("design:type", String)
], PointsProduct.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PointsProduct.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PointsProduct.prototype, "channelId", void 0);
exports.PointsProduct = PointsProduct = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['channelId', 'status']),
    __metadata("design:paramtypes", [Object])
], PointsProduct);
//# sourceMappingURL=points-product.entity.js.map