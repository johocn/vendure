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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcmShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const tcm_crypto_service_1 = require("../crypto/tcm-crypto.service");
const tcm_follow_up_task_entity_1 = require("../entities/tcm-follow-up-task.entity");
const tcm_medical_record_entity_1 = require("../entities/tcm-medical-record.entity");
const tcm_wellness_plan_entity_1 = require("../entities/tcm-wellness-plan.entity");
const tcm_clinic_service_1 = require("../services/tcm-clinic.service");
const tcm_wellness_service_1 = require("../services/tcm-wellness.service");
let TcmShopResolver = class TcmShopResolver {
    constructor(connection, clinicService, wellnessService, crypto) {
        this.connection = connection;
        this.clinicService = clinicService;
        this.wellnessService = wellnessService;
        this.crypto = crypto;
    }
    /** 归属校验：ctx.activeUserId → Customer → PatientProfile.customerId 必须一致 */
    async assertOwnProfile(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.ForbiddenError();
        }
        const customer = await this.clinicService.findCustomerByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.ForbiddenError();
        }
        const profile = await this.clinicService.findProfileByCustomerId(ctx, Number(customer.id));
        if (!profile) {
            throw new core_1.ForbiddenError();
        }
        return profile;
    }
    async myPatientProfile(ctx) {
        return this.assertOwnProfile(ctx);
    }
    /** 病志列表：解密 diagnosis 后截前 20 字符作为脱敏摘要，绝不返回 *Enc/prescription 原文 */
    async myMedicalRecords(ctx, skip, take) {
        const profile = await this.assertOwnProfile(ctx);
        const [rows, total] = await this.connection
            .getRepository(ctx, tcm_medical_record_entity_1.TcmMedicalRecord)
            .findAndCount({
            where: { patientProfileId: Number(profile.id) },
            order: { id: 'DESC' },
            skip,
            take: take !== null && take !== void 0 ? take : 10,
        });
        return {
            items: rows.map(r => ({
                id: Number(r.id),
                version: r.version,
                createdAt: r.createdAt,
                diagnosisSummary: this.crypto.decrypt(r.diagnosisEnc).slice(0, 20),
            })),
            totalItems: total,
        };
    }
    /** 本人 ACTIVE 且最新的康养规划（含计划项） */
    async myWellnessPlan(ctx) {
        const profile = await this.assertOwnProfile(ctx);
        const plan = await this.connection.getRepository(ctx, tcm_wellness_plan_entity_1.TcmWellnessPlan).findOne({
            where: { patientProfileId: Number(profile.id), status: 'ACTIVE' },
            order: { id: 'DESC' },
        });
        if (!plan) {
            return null;
        }
        const items = await this.wellnessService.itemsOfPlan(ctx, Number(plan.id));
        return Object.assign(Object.assign({}, plan), { items });
    }
    /** 本人待办随访（PENDING，按 dueAt 升序） */
    async myFollowUps(ctx) {
        const profile = await this.assertOwnProfile(ctx);
        return this.connection.getRepository(ctx, tcm_follow_up_task_entity_1.TcmFollowUpTask).find({
            where: { patientProfileId: Number(profile.id), status: 'PENDING' },
            order: { dueAt: 'ASC' },
        });
    }
};
exports.TcmShopResolver = TcmShopResolver;
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], TcmShopResolver.prototype, "myPatientProfile", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('skip')),
    __param(2, (0, graphql_1.Args)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], TcmShopResolver.prototype, "myMedicalRecords", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], TcmShopResolver.prototype, "myWellnessPlan", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], TcmShopResolver.prototype, "myFollowUps", null);
exports.TcmShopResolver = TcmShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        tcm_clinic_service_1.TcmClinicService,
        tcm_wellness_service_1.TcmWellnessService,
        tcm_crypto_service_1.TcmCryptoService])
], TcmShopResolver);
//# sourceMappingURL=tcm-shop.resolver.js.map