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
exports.HotelRatePlan = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 酒店房价方案（P2，房型维度）：
 * - code 行内唯一（unique(productVariantId, code)），下单写入 OrderLine.customFields.ratePlanCode
 * - adjustType：discount（每晚 ×adjustValue/1000）/ fixed（每晚固定价）/ surcharge（每晚 +adjustValue）
 * - adjustValue：discount 存千分比（900 = ×0.9）；fixed/surcharge 存分
 * - memberOnly：会员等级门槛（沿用 vcash-pos myMemberPrice 的会员等级通道，Customer.customFields.memberLevel），
 *   存数字字符串（如 '2' = 达到 2 级及以上可见）；null = 全员可见
 * - dateFrom/dateTo：售卖期（以入住日为准，含两端）；null = 长期有效
 * - cancelPolicyOverride：JSON 字符串 CancelPolicy（{type:'freeUntil'|'nonRefundable', freeUntilHours?}），
 *   P4 取消退款时优先于房型级 hotelRoomConfig.cancelPolicy
 * - name 展示名：纯文本或 LocalizedText JSON 字符串（string | Record<locale,string>），C 端 localizeText 解析
 */
let HotelRatePlan = class HotelRatePlan extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.HotelRatePlan = HotelRatePlan;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], HotelRatePlan.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], HotelRatePlan.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], HotelRatePlan.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], HotelRatePlan.prototype, "adjustType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], HotelRatePlan.prototype, "adjustValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], HotelRatePlan.prototype, "memberOnly", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], HotelRatePlan.prototype, "dateFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], HotelRatePlan.prototype, "dateTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], HotelRatePlan.prototype, "cancelPolicyOverride", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], HotelRatePlan.prototype, "enabled", void 0);
exports.HotelRatePlan = HotelRatePlan = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('uk_hotel_rate_plan', ['productVariantId', 'code'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], HotelRatePlan);
//# sourceMappingURL=rate-plan.entity.js.map