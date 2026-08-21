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
exports.CommunityCommissionEntry = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
let CommunityCommissionEntry = class CommunityCommissionEntry extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CommunityCommissionEntry = CommunityCommissionEntry;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CommunityCommissionEntry.prototype, "leaderId", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CommunityCommissionEntry.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }) // 佣金(分)
    ,
    __metadata("design:type", Number)
], CommunityCommissionEntry.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'pending' }),
    __metadata("design:type", String)
], CommunityCommissionEntry.prototype, "status", void 0);
exports.CommunityCommissionEntry = CommunityCommissionEntry = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CommunityCommissionEntry);
//# sourceMappingURL=community-commission-entry.entity.js.map