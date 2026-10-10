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
exports.PointsOrder = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 积分订单。状态机：
 *  纯积分+virtual: completed（扣分即完成）
 *  纯积分+physical: pending_ship → shipped → completed
 *  混合价: pending_payment(已扣分+已建支付单) → 支付回调后 → pending_ship/completed
 *  cancelled: 未支付取消（退积分+回补库存）
 */
let PointsOrder = class PointsOrder extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PointsOrder = PointsOrder;
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], PointsOrder.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PointsOrder.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PointsOrder.prototype, "pointsProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Object)
], PointsOrder.prototype, "productSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PointsOrder.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PointsOrder.prototype, "pointsTotal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PointsOrder.prototype, "cashTotal", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PointsOrder.prototype, "deliveryType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PointsOrder.prototype, "addressSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PointsOrder.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], PointsOrder.prototype, "trackingNo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], PointsOrder.prototype, "paidAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], PointsOrder.prototype, "shippedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], PointsOrder.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PointsOrder.prototype, "channelId", void 0);
exports.PointsOrder = PointsOrder = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['customerId', 'channelId']),
    (0, typeorm_1.Index)(['channelId', 'status']),
    __metadata("design:paramtypes", [Object])
], PointsOrder);
//# sourceMappingURL=points-order.entity.js.map