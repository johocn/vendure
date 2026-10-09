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
exports.TcmPlanItem = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let TcmPlanItem = class TcmPlanItem extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.TcmPlanItem = TcmPlanItem;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], TcmPlanItem.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], TcmPlanItem.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", String)
], TcmPlanItem.prototype, "frequency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], TcmPlanItem.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], TcmPlanItem.prototype, "orderId", void 0);
exports.TcmPlanItem = TcmPlanItem = __decorate([
    (0, typeorm_1.Entity)({ name: 'tcm_plan_item' }),
    (0, typeorm_1.Index)(['planId']),
    __metadata("design:paramtypes", [Object])
], TcmPlanItem);
//# sourceMappingURL=tcm-plan-item.entity.js.map