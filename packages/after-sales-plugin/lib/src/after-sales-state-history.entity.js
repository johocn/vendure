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
exports.AfterSalesStateHistory = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const after_sales_request_entity_1 = require("./after-sales-request.entity");
/** 售后单状态流转历史（每次状态变更落一行，供 C 端/后台时间线显示逐节点时间） */
let AfterSalesStateHistory = class AfterSalesStateHistory extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.AfterSalesStateHistory = AfterSalesStateHistory;
__decorate([
    (0, typeorm_1.ManyToOne)(() => after_sales_request_entity_1.AfterSalesRequest, (r) => r.history, { onDelete: 'CASCADE' }),
    __metadata("design:type", after_sales_request_entity_1.AfterSalesRequest)
], AfterSalesStateHistory.prototype, "request", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AfterSalesStateHistory.prototype, "requestId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesStateHistory.prototype, "fromState", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AfterSalesStateHistory.prototype, "toState", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesStateHistory.prototype, "operatorUserId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AfterSalesStateHistory.prototype, "createdAt", void 0);
exports.AfterSalesStateHistory = AfterSalesStateHistory = __decorate([
    (0, typeorm_1.Entity)('after_sales_state_history'),
    (0, typeorm_1.Index)(['requestId']),
    __metadata("design:paramtypes", [Object])
], AfterSalesStateHistory);
//# sourceMappingURL=after-sales-state-history.entity.js.map