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
exports.ShippingProfileMigrationService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shipping_profile_entity_1 = require("./shipping-profile.entity");
const shipping_profile_method_entity_1 = require("./shipping-profile-method.entity");
let ShippingProfileMigrationService = class ShippingProfileMigrationService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 将档案级 pickupLocations 迁移到对应自提方式的 options.pickupLocationIds */
    async migrateLegacyPickupLocations(ctx) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, shipping_profile_entity_1.ShippingProfile);
        const jmRepo = this.connection.getRepository(ctx, shipping_profile_method_entity_1.ShippingProfileMethod);
        const profiles = await repo.find({ relations: ['shippingMethods', 'pickupLocations'] });
        for (const p of profiles) {
            if (!((_a = p.pickupLocations) === null || _a === void 0 ? void 0 : _a.length))
                continue;
            const pickupMethod = (_b = p.shippingMethods) === null || _b === void 0 ? void 0 : _b.find((m) => { var _a; return /pickup|store/i.test((_a = m === null || m === void 0 ? void 0 : m.code) !== null && _a !== void 0 ? _a : ''); });
            if (!pickupMethod)
                continue;
            const options = { pickupLocationIds: p.pickupLocations.map((l) => String(l.id)) };
            const existing = await jmRepo.findOne({
                where: { profileId: String(p.id), shippingMethodId: String(pickupMethod.id) },
            });
            if (existing) {
                existing.options = options;
                await jmRepo.save(existing);
            }
            else {
                await jmRepo.save(new shipping_profile_method_entity_1.ShippingProfileMethod({
                    profileId: String(p.id),
                    shippingMethodId: String(pickupMethod.id),
                    mode: 'pickup',
                    options,
                }));
            }
        }
    }
};
exports.ShippingProfileMigrationService = ShippingProfileMigrationService;
exports.ShippingProfileMigrationService = ShippingProfileMigrationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], ShippingProfileMigrationService);
//# sourceMappingURL=shipping-profile-migration.service.js.map