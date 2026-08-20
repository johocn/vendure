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
exports.OrderPackage = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/** 拆单包裹（追溯底座）：一个包 = 一个出货仓的履约单元，落库拆单确认时的 SplitPackage */
let OrderPackage = class OrderPackage extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.OrderPackage = OrderPackage;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrderPackage.prototype, "code", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], OrderPackage.prototype, "orderId", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], OrderPackage.prototype, "stockLocationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], OrderPackage.prototype, "linesJson", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], OrderPackage.prototype, "shippingFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'self' }),
    __metadata("design:type", String)
], OrderPackage.prototype, "deliveryMode", void 0);
__decorate([
    (0, core_1.EntityId)({ nullable: true }),
    __metadata("design:type", Object)
], OrderPackage.prototype, "fulfillmentId", void 0);
__decorate([
    (0, core_1.EntityId)({ nullable: true }),
    __metadata("design:type", Object)
], OrderPackage.prototype, "deliveryOrderId", void 0);
exports.OrderPackage = OrderPackage = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], OrderPackage);
//# sourceMappingURL=order-package.entity.js.map