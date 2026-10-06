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
exports.CampusFulfillmentConfig = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let CampusFulfillmentConfig = class CampusFulfillmentConfig extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusFulfillmentConfig = CampusFulfillmentConfig;
__decorate([
    (0, typeorm_1.Column)('int', { unique: true }),
    __metadata("design:type", Object)
], CampusFulfillmentConfig.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', default: '["R1","R3","R4","R5"]' }),
    __metadata("design:type", Array)
], CampusFulfillmentConfig.prototype, "routesEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 100 }),
    __metadata("design:type", Number)
], CampusFulfillmentConfig.prototype, "riderCommissionRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 10 }),
    __metadata("design:type", Number)
], CampusFulfillmentConfig.prototype, "autoAssignMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], CampusFulfillmentConfig.prototype, "paused", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 30 }),
    __metadata("design:type", Number)
], CampusFulfillmentConfig.prototype, "autoRefundMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 45 }),
    __metadata("design:type", Number)
], CampusFulfillmentConfig.prototype, "inProgressSlaMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], CampusFulfillmentConfig.prototype, "compensationCouponTemplateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusFulfillmentConfig.prototype, "deliveryMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusFulfillmentConfig.prototype, "minOrderAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusFulfillmentConfig.prototype, "deliveryFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusFulfillmentConfig.prototype, "storeAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusFulfillmentConfig.prototype, "storePhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusFulfillmentConfig.prototype, "storeNotice", void 0);
exports.CampusFulfillmentConfig = CampusFulfillmentConfig = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CampusFulfillmentConfig);
//# sourceMappingURL=campus-fulfillment-config.entity.js.map