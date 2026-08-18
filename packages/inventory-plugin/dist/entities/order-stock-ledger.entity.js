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
exports.OrderStockLedger = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 行级供销存账本：订单 / 进销存单据 / 售后 三者之间的统一关联中间表。
 *
 * 任何真实 onHand 变动（发货扣减、退货入库、入库单、出库单、调拨收发、盘点差异、手工调账）
 * 都通过 `inventory.service.adjustStockForLocation` 在**同一事务**内写一条流水，
 * 沿 bizCode（orderCode / afterSalesCode / RKT.. / DBT..）即可追溯完整链路。
 */
let OrderStockLedger = class OrderStockLedger extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.OrderStockLedger = OrderStockLedger;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrderStockLedger.prototype, "code", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], OrderStockLedger.prototype, "productVariantId", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], OrderStockLedger.prototype, "stockLocationId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrderStockLedger.prototype, "bizType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrderStockLedger.prototype, "bizCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Object)
], OrderStockLedger.prototype, "orderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrderStockLedger.prototype, "direction", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], OrderStockLedger.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], OrderStockLedger.prototype, "beforeOnHand", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], OrderStockLedger.prototype, "afterOnHand", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Object)
], OrderStockLedger.prototype, "otherLocationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrderStockLedger.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], OrderStockLedger.prototype, "channels", void 0);
exports.OrderStockLedger = OrderStockLedger = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], OrderStockLedger);
