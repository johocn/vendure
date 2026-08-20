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
exports.AfterSalesRequest = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let AfterSalesRequest = class AfterSalesRequest extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.AfterSalesRequest = AfterSalesRequest;
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Order),
    __metadata("design:type", core_1.Order)
], AfterSalesRequest.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AfterSalesRequest.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.OrderLine, { nullable: true }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "orderLine", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "orderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'return_refund' }),
    __metadata("design:type", String)
], AfterSalesRequest.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'Pending' }),
    __metadata("design:type", String)
], AfterSalesRequest.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AfterSalesRequest.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "evidenceImages", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AfterSalesRequest.prototype, "refundAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "receivedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "restockJson", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "returnTrackingNo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "returnCarrier", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "rejectReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "refundTransactionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "actualRefundAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], AfterSalesRequest.prototype, "refundedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", Object)
], AfterSalesRequest.prototype, "refundError", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Customer),
    __metadata("design:type", core_1.Customer)
], AfterSalesRequest.prototype, "customer", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AfterSalesRequest.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], AfterSalesRequest.prototype, "channels", void 0);
exports.AfterSalesRequest = AfterSalesRequest = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], AfterSalesRequest);
//# sourceMappingURL=after-sales-request.entity.js.map