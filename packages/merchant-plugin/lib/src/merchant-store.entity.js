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
exports.MerchantStore = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const localize_1 = require("./localize");
const merchant_entity_1 = require("./merchant.entity");
/**
 * 门店：商户下的经营单元（可多门店）。
 *
 * 门店独立于租户存在，租户通过 merchant_store_channel 认领绑定；优惠券、外卖、自提
 * 等后续只引用 merchant_store.id。
 */
let MerchantStore = class MerchantStore extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.MerchantStore = MerchantStore;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MerchantStore.prototype, "merchantId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => merchant_entity_1.Merchant, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'merchantId' }),
    __metadata("design:type", merchant_entity_1.Merchant)
], MerchantStore.prototype, "merchant", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', unique: true }),
    __metadata("design:type", String)
], MerchantStore.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', transformer: localize_1.localizedTextColumn }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'DIRECT' }),
    __metadata("design:type", String)
], MerchantStore.prototype, "storeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MerchantStore.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MerchantStore.prototype, "weight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'CN' }),
    __metadata("design:type", String)
], MerchantStore.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "province", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "cityCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "district", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "street", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "addressLine", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "detail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "postalCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "lat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "lng", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'GCJ02' }),
    __metadata("design:type", String)
], MerchantStore.prototype, "coordinateSystem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "geohash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "mapPoiId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "mapProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "navigationAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "backupPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "managerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "managerPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "wechat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "servicePhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "businessHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "businessHoursText", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'Asia/Shanghai' }),
    __metadata("design:type", String)
], MerchantStore.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "specialDates", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "holidayPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'OPEN' }),
    __metadata("design:type", String)
], MerchantStore.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "statusNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "reopenAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], MerchantStore.prototype, "acceptingOrders", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "coverImage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "photos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "videos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "panoramaUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, transformer: localize_1.localizedTextColumn }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "notice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "facilities", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], MerchantStore.prototype, "supportsRedemption", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "redemptionHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "dailyRedeemLimit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], MerchantStore.prototype, "requiresReservation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "reservationPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], MerchantStore.prototype, "supportsDelivery", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "deliveryRadiusKm", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "deliveryFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "minOrderAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "deliveryMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "externalIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'MANUAL' }),
    __metadata("design:type", String)
], MerchantStore.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "lastSyncAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], MerchantStore.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], MerchantStore.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], MerchantStore.prototype, "deletedAt", void 0);
exports.MerchantStore = MerchantStore = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['merchantId']),
    __metadata("design:paramtypes", [Object])
], MerchantStore);
//# sourceMappingURL=merchant-store.entity.js.map