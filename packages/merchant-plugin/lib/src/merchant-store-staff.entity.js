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
exports.MerchantStoreStaff = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 门店员工：门店 × 后台用户（Administrator）的岗位关系。
 * 用户本体仍是 Vendure 原生 Administrator，本表只承载门店域的角色与状态。
 */
let MerchantStoreStaff = class MerchantStoreStaff extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.MerchantStoreStaff = MerchantStoreStaff;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MerchantStoreStaff.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MerchantStoreStaff.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStoreStaff.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStoreStaff.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'CLERK' }),
    __metadata("design:type", String)
], MerchantStoreStaff.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'ACTIVE' }),
    __metadata("design:type", String)
], MerchantStoreStaff.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date, nullable: true }),
    __metadata("design:type", Object)
], MerchantStoreStaff.prototype, "lastLoginAt", void 0);
exports.MerchantStoreStaff = MerchantStoreStaff = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['storeId']),
    (0, typeorm_1.Index)(['storeId', 'userId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], MerchantStoreStaff);
//# sourceMappingURL=merchant-store-staff.entity.js.map