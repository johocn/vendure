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
exports.CouponBundleItem = exports.CouponBundle = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const localize_1 = require("./localize");
/**
 * 出售型券包：购买一次按 CouponBundleItem 循环生成包内全部券。
 * 名称/说明为 LocalizedText（存 text 列，transformer 序列化）。
 */
let CouponBundle = class CouponBundle extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CouponBundle = CouponBundle;
__decorate([
    (0, typeorm_1.Column)('text', { nullable: false, transformer: localize_1.localizedTextColumn }),
    __metadata("design:type", Object)
], CouponBundle.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true, transformer: localize_1.localizedTextColumn }),
    __metadata("design:type", Object)
], CouponBundle.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CouponBundle.prototype, "salePrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], CouponBundle.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CouponBundle.prototype, "shopId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel, { eager: false }),
    __metadata("design:type", core_1.Channel)
], CouponBundle.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponBundle.prototype, "channelId", void 0);
exports.CouponBundle = CouponBundle = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CouponBundle);
/** 券包内单项：某券模板在包内的张数 */
let CouponBundleItem = class CouponBundleItem extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CouponBundleItem = CouponBundleItem;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CouponBundleItem.prototype, "bundleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CouponBundleItem.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], CouponBundleItem.prototype, "quantity", void 0);
exports.CouponBundleItem = CouponBundleItem = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CouponBundleItem);
//# sourceMappingURL=coupon-bundle.entity.js.map