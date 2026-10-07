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
exports.AfterSalesMessage = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const after_sales_request_entity_1 = require("./after-sales-request.entity");
/** 售后协商留言（顾客与商家在售后单内的双向沟通记录，Closed 后禁言） */
let AfterSalesMessage = class AfterSalesMessage extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.AfterSalesMessage = AfterSalesMessage;
__decorate([
    (0, typeorm_1.ManyToOne)(() => after_sales_request_entity_1.AfterSalesRequest, { onDelete: 'CASCADE' }),
    __metadata("design:type", after_sales_request_entity_1.AfterSalesRequest)
], AfterSalesMessage.prototype, "request", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AfterSalesMessage.prototype, "requestId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'customer' }),
    __metadata("design:type", String)
], AfterSalesMessage.prototype, "senderType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesMessage.prototype, "senderUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AfterSalesMessage.prototype, "senderName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], AfterSalesMessage.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], AfterSalesMessage.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AfterSalesMessage.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], AfterSalesMessage.prototype, "updatedAt", void 0);
exports.AfterSalesMessage = AfterSalesMessage = __decorate([
    (0, typeorm_1.Entity)('after_sales_message'),
    (0, typeorm_1.Index)(['requestId']),
    __metadata("design:paramtypes", [Object])
], AfterSalesMessage);
//# sourceMappingURL=after-sales-message.entity.js.map