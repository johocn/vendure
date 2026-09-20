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
exports.PromotionRule = void 0;
const typeorm_1 = require("typeorm");
let PromotionRule = class PromotionRule {
    constructor() {
        this.description = null;
        this.collectionId = null;
        /**
         * 全局唯一优先级，数字大者优先；同 saving 取 priority 大者。
         */
        this.priority = 10;
        this.active = true;
        this.startTime = null;
        this.endTime = null;
        /**
         * 按 type 不同（JSON 字符串）：
         * - fullReduction: { tiers: [{ threshold, reduction }, ...] }
         * - discount: { minOrderValue?: number }
         * - buyGift: { buyVariantId, buyQuantity }
         */
        this.conditions = null;
        /**
         * 按 type 不同（JSON 字符串）：
         * - fullReduction: null（reduction 写在 conditions.tiers）
         * - discount: { discountPercent: number }
         * - buyGift: { giftVariantId, giftQuantity }
         */
        this.actions = null;
    }
};
exports.PromotionRule = PromotionRule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PromotionRule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PromotionRule.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], PromotionRule.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], PromotionRule.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], PromotionRule.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], PromotionRule.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], PromotionRule.prototype, "collectionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 10 }),
    __metadata("design:type", Number)
], PromotionRule.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], PromotionRule.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], PromotionRule.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], PromotionRule.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], PromotionRule.prototype, "conditions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], PromotionRule.prototype, "actions", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], PromotionRule.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], PromotionRule.prototype, "updatedAt", void 0);
exports.PromotionRule = PromotionRule = __decorate([
    (0, typeorm_1.Entity)()
], PromotionRule);
//# sourceMappingURL=promotion-rule.entity.js.map