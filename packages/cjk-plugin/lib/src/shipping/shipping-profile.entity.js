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
exports.ShippingProfile = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const pickup_location_entity_1 = require("../pickup/pickup-location.entity");
/**
 * 配送方案档案
 *
 * 分为两类：
 * - 全局档案（isGlobal=true）：由超级管理员维护，所有租户可选用
 * - 租户档案（isGlobal=false）：由租户管理员维护，仅本租户可见
 *
 * 租户从档案创建配送方式后，生成的 ShippingMethod 实例与档案完全解耦。
 */
let ShippingProfile = class ShippingProfile extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ShippingProfile = ShippingProfile;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShippingProfile.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ShippingProfile.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShippingProfile.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ShippingProfile.prototype, "isGlobal", void 0);
__decorate([
    (0, core_1.EntityId)({ nullable: true }),
    __metadata("design:type", Object)
], ShippingProfile.prototype, "ownerChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ShippingProfile.prototype, "freeShippingThreshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ShippingProfile.prototype, "isTenantDefault", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ShippingProfile.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.ShippingMethod),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], ShippingProfile.prototype, "shippingMethods", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => pickup_location_entity_1.PickupLocation),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], ShippingProfile.prototype, "pickupLocations", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], ShippingProfile.prototype, "channels", void 0);
exports.ShippingProfile = ShippingProfile = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], ShippingProfile);
//# sourceMappingURL=shipping-profile.entity.js.map