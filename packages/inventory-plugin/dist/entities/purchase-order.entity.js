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
exports.PurchaseOrderLine = exports.PurchaseOrder = void 0;
// e:\code\vendure\packages\inventory-plugin\src\entities\purchase-order.entity.ts
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const supplier_entity_1 = require("./supplier.entity");
let PurchaseOrder = class PurchaseOrder extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PurchaseOrder = PurchaseOrder;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'Draft' }),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => supplier_entity_1.Supplier),
    __metadata("design:type", supplier_entity_1.Supplier)
], PurchaseOrder.prototype, "supplier", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], PurchaseOrder.prototype, "supplierId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.StockLocation),
    __metadata("design:type", core_1.StockLocation)
], PurchaseOrder.prototype, "targetLocation", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], PurchaseOrder.prototype, "targetLocationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "staffId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], PurchaseOrder.prototype, "orderDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], PurchaseOrder.prototype, "expectedArrivalDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PurchaseOrder.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PurchaseOrderLine, line => line.order, { cascade: true }),
    __metadata("design:type", Array)
], PurchaseOrder.prototype, "lines", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], PurchaseOrder.prototype, "orderedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], PurchaseOrder.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], PurchaseOrder.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PurchaseOrder.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], PurchaseOrder.prototype, "channels", void 0);
exports.PurchaseOrder = PurchaseOrder = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], PurchaseOrder);
let PurchaseOrderLine = class PurchaseOrderLine extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
    get amount() {
        var _a;
        return ((_a = this.unitPrice) !== null && _a !== void 0 ? _a : 0) * this.quantity;
    }
};
exports.PurchaseOrderLine = PurchaseOrderLine;
__decorate([
    (0, typeorm_1.ManyToOne)(() => PurchaseOrder),
    __metadata("design:type", PurchaseOrder)
], PurchaseOrderLine.prototype, "order", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], PurchaseOrderLine.prototype, "orderId", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], PurchaseOrderLine.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PurchaseOrderLine.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PurchaseOrderLine.prototype, "receivedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], PurchaseOrderLine.prototype, "unitPrice", void 0);
exports.PurchaseOrderLine = PurchaseOrderLine = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], PurchaseOrderLine);
