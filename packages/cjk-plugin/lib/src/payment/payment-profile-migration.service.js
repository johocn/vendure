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
exports.PaymentProfileMigrationService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const payment_profile_entity_1 = require("./payment-profile.entity");
const payment_profile_method_entity_1 = require("./payment-profile-method.entity");
let PaymentProfileMigrationService = class PaymentProfileMigrationService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 将档案级 installmentOptions 迁移到对应支付方式的 options */
    async migrateLegacyInstallmentOptions(ctx) {
        var _a;
        const repo = this.connection.getRepository(ctx, payment_profile_entity_1.PaymentProfile);
        const jmRepo = this.connection.getRepository(ctx, payment_profile_method_entity_1.PaymentProfileMethod);
        const profiles = await repo.find({ relations: ['paymentMethods'] });
        for (const p of profiles) {
            if (!p.installmentOptions)
                continue;
            const opts = Object.assign({}, p.installmentOptions);
            for (const pm of (_a = p.paymentMethods) !== null && _a !== void 0 ? _a : []) {
                const existing = await jmRepo.findOne({
                    where: { profileId: String(p.id), paymentMethodId: String(pm.id) },
                });
                if (existing) {
                    existing.options = opts;
                    await jmRepo.save(existing);
                }
                else {
                    await jmRepo.save(new payment_profile_method_entity_1.PaymentProfileMethod({
                        profileId: String(p.id),
                        paymentMethodId: String(pm.id),
                        mode: 'installment',
                        options: opts,
                    }));
                }
            }
        }
    }
};
exports.PaymentProfileMigrationService = PaymentProfileMigrationService;
exports.PaymentProfileMigrationService = PaymentProfileMigrationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], PaymentProfileMigrationService);
//# sourceMappingURL=payment-profile-migration.service.js.map