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
exports.ReviewAlert = exports.ReviewAlertRule = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * P4-2 评价品质闭环 · 渠道级预警规则（每渠道一条，缺省 2 星以下预警、不发券）。
 * 表由 campus-delivery-plugin 的 p10-review-alert 迁移创建（生产 synchronize:false）。
 */
let ReviewAlertRule = class ReviewAlertRule extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ReviewAlertRule = ReviewAlertRule;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ReviewAlertRule.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], ReviewAlertRule.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 2 }),
    __metadata("design:type", Number)
], ReviewAlertRule.prototype, "maxRating", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ReviewAlertRule.prototype, "couponTemplateId", void 0);
exports.ReviewAlertRule = ReviewAlertRule = __decorate([
    (0, typeorm_1.Entity)('campus_review_alert_rule'),
    __metadata("design:paramtypes", [Object])
], ReviewAlertRule);
/**
 * P4-2 评价品质闭环 · 单条差评预警（reviewId 唯一，幂等）。
 * 与评价解耦存一份快照（正文/星级），后台列表无需 join 评价表。
 */
let ReviewAlert = class ReviewAlert extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ReviewAlert = ReviewAlert;
__decorate([
    (0, typeorm_1.Column)({ type: 'int', unique: true }),
    __metadata("design:type", Number)
], ReviewAlert.prototype, "reviewId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ReviewAlert.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ReviewAlert.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ReviewAlert.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ReviewAlert.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ReviewAlert.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], ReviewAlert.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'none' }),
    __metadata("design:type", String)
], ReviewAlert.prototype, "couponStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ReviewAlert.prototype, "couponCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'new' }),
    __metadata("design:type", String)
], ReviewAlert.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ReviewAlert.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ReviewAlert.prototype, "handledAt", void 0);
exports.ReviewAlert = ReviewAlert = __decorate([
    (0, typeorm_1.Entity)('campus_review_alert'),
    __metadata("design:paramtypes", [Object])
], ReviewAlert);
//# sourceMappingURL=review-alert.entity.js.map