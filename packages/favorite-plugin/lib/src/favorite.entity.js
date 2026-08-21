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
exports.Favorite = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 收藏/关注记录。
 * - 收藏商品：productId 非空；关注店铺：shopId 非空（二者其一）。
 * - 复合唯一约束使同一顾客对同一商品/店铺天然幂等（toggle 语义）。
 * - createdAt/updatedAt 由 VendureEntity 基类提供。
 */
let Favorite = class Favorite extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.Favorite = Favorite;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], Favorite.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], Favorite.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], Favorite.prototype, "shopId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], Favorite.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], Favorite.prototype, "channels", void 0);
exports.Favorite = Favorite = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['customerId', 'productId'], { unique: true }),
    (0, typeorm_1.Index)(['customerId', 'shopId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], Favorite);
//# sourceMappingURL=favorite.entity.js.map