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
exports.Wallet = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 全局共享余额钱包
 *
 * **全局唯一共享账户**：所有租户 / 所有档案合单共用同一个余额，总合并清算。
 * 表中仅维护一行（全局只有这一份余额）。跨租户、跨档案的余额支付统一从此扣减。
 *
 * `createdAt` / `updatedAt` 由 VendureEntity 基类提供（CreateDateColumn / UpdateDateColumn）。
 */
let Wallet = class Wallet extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.Wallet = Wallet;
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Wallet.prototype, "balance", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Wallet.prototype, "currencyCode", void 0);
exports.Wallet = Wallet = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], Wallet);
//# sourceMappingURL=wallet.entity.js.map