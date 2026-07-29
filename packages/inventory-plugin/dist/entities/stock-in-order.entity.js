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
exports.StockInOrderLine = exports.StockInOrder = void 0;
// e:\code\vendure\packages\inventory-plugin\src\entities\stock-in-order.entity.ts
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
let StockInOrder = class StockInOrder extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.StockInOrder = StockInOrder;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StockInOrder.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Pending' }),
    __metadata("design:type", String)
], StockInOrder.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StockInOrder.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StockInOrder.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StockInOrder.prototype, "staffId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.StockLocation),
    __metadata("design:type", core_1.StockLocation)
], StockInOrder.prototype, "targetLocation", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockInOrder.prototype, "targetLocationId", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => StockInOrderLine, line => line.order, { cascade: true }),
    __metadata("design:type", Array)
], StockInOrder.prototype, "lines", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], StockInOrder.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], StockInOrder.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], StockInOrder.prototype, "channels", void 0);
exports.StockInOrder = StockInOrder = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], StockInOrder);
let StockInOrderLine = class StockInOrderLine extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.StockInOrderLine = StockInOrderLine;
__decorate([
    (0, typeorm_1.ManyToOne)(() => StockInOrder),
    __metadata("design:type", StockInOrder)
], StockInOrderLine.prototype, "order", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockInOrderLine.prototype, "orderId", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockInOrderLine.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], StockInOrderLine.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], StockInOrderLine.prototype, "unitPrice", void 0);
exports.StockInOrderLine = StockInOrderLine = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], StockInOrderLine);
