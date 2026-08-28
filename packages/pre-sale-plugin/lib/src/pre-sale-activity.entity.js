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
exports.PreSaleActivity = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 预售活动。
 * 支持三种模式：
 * - full（全款预售）：预售期一次性收全款 → 到货后发货
 * - deposit（定金预售）：先收定金 → 到货/尾款窗口开启后收尾款 → 补齐后发货
 * - 预售价格分档：presalePrice < 原价，结算期 Promotion 动态打折到预售价
 */
let PreSaleActivity = class PreSaleActivity extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PreSaleActivity = PreSaleActivity;
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], PreSaleActivity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], PreSaleActivity.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], PreSaleActivity.prototype, "startAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], PreSaleActivity.prototype, "endAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], PreSaleActivity.prototype, "releaseAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], PreSaleActivity.prototype, "tailStartAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], PreSaleActivity.prototype, "tailEndAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PreSaleActivity.prototype, "presalePrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PreSaleActivity.prototype, "depositAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PreSaleActivity.prototype, "totalStock", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PreSaleActivity.prototype, "soldCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], PreSaleActivity.prototype, "limitPerUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PreSaleActivity.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PreSaleActivity.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PreSaleActivity.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'upcoming' }),
    __metadata("design:type", String)
], PreSaleActivity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], PreSaleActivity.prototype, "channels", void 0);
exports.PreSaleActivity = PreSaleActivity = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], PreSaleActivity);
//# sourceMappingURL=pre-sale-activity.entity.js.map