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
exports.StockOutOrderLine = exports.StockOutOrder = void 0;
// e:\code\vendure\packages\inventory-plugin\src\entities\stock-out-order.entity.ts
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
let StockOutOrder = class StockOutOrder extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.StockOutOrder = StockOutOrder;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StockOutOrder.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Pending' }),
    __metadata("design:type", String)
], StockOutOrder.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StockOutOrder.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StockOutOrder.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StockOutOrder.prototype, "staffId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.StockLocation),
    __metadata("design:type", core_1.StockLocation)
], StockOutOrder.prototype, "sourceLocation", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockOutOrder.prototype, "sourceLocationId", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => StockOutOrderLine, line => line.order, { cascade: true }),
    __metadata("design:type", Array)
], StockOutOrder.prototype, "lines", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], StockOutOrder.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], StockOutOrder.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], StockOutOrder.prototype, "channels", void 0);
exports.StockOutOrder = StockOutOrder = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], StockOutOrder);
let StockOutOrderLine = class StockOutOrderLine extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.StockOutOrderLine = StockOutOrderLine;
__decorate([
    (0, typeorm_1.ManyToOne)(() => StockOutOrder),
    __metadata("design:type", StockOutOrder)
], StockOutOrderLine.prototype, "order", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockOutOrderLine.prototype, "orderId", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockOutOrderLine.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], StockOutOrderLine.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], StockOutOrderLine.prototype, "unitPrice", void 0);
exports.StockOutOrderLine = StockOutOrderLine = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], StockOutOrderLine);
