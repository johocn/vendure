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
exports.StockMoveOrderLine = exports.StockMoveOrder = void 0;
// e:\code\vendure\packages\inventory-plugin\src\entities\stock-move-order.entity.ts
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
let StockMoveOrder = class StockMoveOrder extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.StockMoveOrder = StockMoveOrder;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StockMoveOrder.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'Pending' }),
    __metadata("design:type", String)
], StockMoveOrder.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StockMoveOrder.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StockMoveOrder.prototype, "staffId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.StockLocation),
    __metadata("design:type", core_1.StockLocation)
], StockMoveOrder.prototype, "sourceLocation", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockMoveOrder.prototype, "sourceLocationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.StockLocation),
    __metadata("design:type", core_1.StockLocation)
], StockMoveOrder.prototype, "targetLocation", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockMoveOrder.prototype, "targetLocationId", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => StockMoveOrderLine, line => line.order, { cascade: true }),
    __metadata("design:type", Array)
], StockMoveOrder.prototype, "lines", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], StockMoveOrder.prototype, "shippedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], StockMoveOrder.prototype, "receivedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], StockMoveOrder.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], StockMoveOrder.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], StockMoveOrder.prototype, "channels", void 0);
exports.StockMoveOrder = StockMoveOrder = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], StockMoveOrder);
let StockMoveOrderLine = class StockMoveOrderLine extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.StockMoveOrderLine = StockMoveOrderLine;
__decorate([
    (0, typeorm_1.ManyToOne)(() => StockMoveOrder),
    __metadata("design:type", StockMoveOrder)
], StockMoveOrderLine.prototype, "order", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockMoveOrderLine.prototype, "orderId", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StockMoveOrderLine.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], StockMoveOrderLine.prototype, "quantity", void 0);
exports.StockMoveOrderLine = StockMoveOrderLine = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], StockMoveOrderLine);
