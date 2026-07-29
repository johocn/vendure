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
exports.StocktakeOrderLine = exports.StocktakeOrder = void 0;
// e:\code\vendure\packages\inventory-plugin\src\entities\stocktake-order.entity.ts
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
let StocktakeOrder = class StocktakeOrder extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.StocktakeOrder = StocktakeOrder;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StocktakeOrder.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Pending' }),
    __metadata("design:type", String)
], StocktakeOrder.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StocktakeOrder.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StocktakeOrder.prototype, "staffId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.StockLocation),
    __metadata("design:type", core_1.StockLocation)
], StocktakeOrder.prototype, "location", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StocktakeOrder.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => StocktakeOrderLine, line => line.order, { cascade: true }),
    __metadata("design:type", Array)
], StocktakeOrder.prototype, "lines", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], StocktakeOrder.prototype, "countingStartedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], StocktakeOrder.prototype, "reconcilingStartedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], StocktakeOrder.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], StocktakeOrder.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], StocktakeOrder.prototype, "channels", void 0);
exports.StocktakeOrder = StocktakeOrder = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], StocktakeOrder);
let StocktakeOrderLine = class StocktakeOrderLine extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.StocktakeOrderLine = StocktakeOrderLine;
__decorate([
    (0, typeorm_1.ManyToOne)(() => StocktakeOrder),
    __metadata("design:type", StocktakeOrder)
], StocktakeOrderLine.prototype, "order", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StocktakeOrderLine.prototype, "orderId", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], StocktakeOrderLine.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], StocktakeOrderLine.prototype, "systemQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], StocktakeOrderLine.prototype, "countedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], StocktakeOrderLine.prototype, "difference", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], StocktakeOrderLine.prototype, "reconciled", void 0);
exports.StocktakeOrderLine = StocktakeOrderLine = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], StocktakeOrderLine);
