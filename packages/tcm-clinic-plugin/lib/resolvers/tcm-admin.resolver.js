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
exports.TcmAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const tcm_encounter_entity_1 = require("../entities/tcm-encounter.entity");
const tcm_follow_up_task_entity_1 = require("../entities/tcm-follow-up-task.entity");
const tcm_medical_record_entity_1 = require("../entities/tcm-medical-record.entity");
const tcm_patient_profile_entity_1 = require("../entities/tcm-patient-profile.entity");
const tcm_wellness_plan_entity_1 = require("../entities/tcm-wellness-plan.entity");
const tcm_encounter_service_1 = require("../services/tcm-encounter.service");
const tcm_clinic_service_1 = require("../services/tcm-clinic.service");
const tcm_medical_record_service_1 = require("../services/tcm-medical-record.service");
const tcm_audit_service_1 = require("../services/tcm-audit.service");
const tcm_staff_service_1 = require("../services/tcm-staff.service");
const tcm_wellness_service_1 = require("../services/tcm-wellness.service");
let TcmAdminResolver = class TcmAdminResolver {
    constructor(connection, clinicService, staffService, encounterService, recordService, auditService, wellnessService) {
        this.connection = connection;
        this.clinicService = clinicService;
        this.staffService = staffService;
        this.encounterService = encounterService;
        this.recordService = recordService;
        this.auditService = auditService;
        this.wellnessService = wellnessService;
    }
    async clinics(ctx, _options) {
        const items = await this.clinicService.findAll(ctx);
        return { items, totalItems: items.length };
    }
    async createClinic(ctx, input) {
        return this.clinicService.createClinic(ctx, input);
    }
    async createClinicStaff(ctx, input) {
        return this.clinicService.createClinicStaff(ctx, input);
    }
    async createPatientProfile(ctx, input) {
        await this.staffService.assertStaffOfClinic(ctx, input.clinicId);
        return this.clinicService.createPatientProfile(ctx, input);
    }
    async createEncounter(ctx, input) {
        const staff = await this.staffService.assertStaffOfClinic(ctx, input.clinicId);
        return this.encounterService.create(ctx, input, Number(staff.id));
    }
    async startEncounter(ctx, id) {
        return this.encounterService.transition(ctx, Number(String(id).replace('T_', '')), 'ACTIVE');
    }
    async completeEncounter(ctx, id) {
        return this.encounterService.transition(ctx, Number(String(id).replace('T_', '')), 'COMPLETED');
    }
    async createMedicalRecord(ctx, input) {
        // 馆归属来自 encounter：先取 encounter，再守卫，最后落记录
        const encounter = await this.connection
            .getRepository(ctx, tcm_encounter_entity_1.TcmEncounter)
            .findOne({ where: { id: input.encounterId } });
        if (!encounter) {
            throw new core_1.UserInputError(`接诊不存在：${input.encounterId}`);
        }
        const staff = await this.staffService.assertStaffOfClinic(ctx, encounter.clinicId);
        const record = await this.recordService.create(ctx, Number(staff.id), input);
        const view = await this.recordService.decryptView(record);
        return Object.assign(Object.assign({ id: Number(record.id), encounterId: record.encounterId, clinicId: record.clinicId, version: record.version }, view), { revisions: [] });
    }
    async updateMedicalRecord(ctx, id, input) {
        const recordId = Number(String(id).replace('T_', ''));
        const record = await this.connection
            .getRepository(ctx, tcm_medical_record_entity_1.TcmMedicalRecord)
            .findOne({ where: { id: recordId } });
        if (!record) {
            throw new core_1.UserInputError(`病志不存在：${recordId}`);
        }
        // 经病志的 encounterId 取 encounter → 校验馆归属
        const encounter = await this.connection
            .getRepository(ctx, tcm_encounter_entity_1.TcmEncounter)
            .findOne({ where: { id: record.encounterId } });
        if (!encounter) {
            throw new core_1.UserInputError(`接诊不存在：${record.encounterId}`);
        }
        const staff = await this.staffService.assertStaffOfClinic(ctx, encounter.clinicId);
        const updated = await this.recordService.update(ctx, Number(staff.id), recordId, input);
        const view = await this.recordService.decryptView(updated);
        return Object.assign(Object.assign({ id: Number(updated.id), encounterId: updated.encounterId, clinicId: updated.clinicId, version: updated.version }, view), { revisions: [] });
    }
    async medicalRecords(ctx, options) {
        return this.recordService.findAll(ctx, options);
    }
    async auditLogs(ctx, options) {
        return this.auditService.findAll(ctx, options);
    }
    async createWellnessPlan(ctx, input) {
        const staff = await this.staffService.assertStaffOfClinic(ctx, input.clinicId);
        return this.wellnessService.createPlan(ctx, Number(staff.id), input);
    }
    async transitionWellnessPlan(ctx, id, to) {
        const planId = Number(String(id).replace('T_', ''));
        const plan = await this.connection
            .getRepository(ctx, tcm_wellness_plan_entity_1.TcmWellnessPlan)
            .findOne({ where: { id: planId } });
        if (!plan) {
            throw new core_1.UserInputError(`康养规划不存在：${planId}`);
        }
        const staff = await this.staffService.assertStaffOfClinic(ctx, plan.clinicId);
        return this.wellnessService.transitionPlan(ctx, Number(staff.id), planId, to);
    }
    async addPlanItem(ctx, input) {
        // 馆归属来自 plan：先取 plan，再守卫，最后落计划项
        const plan = await this.connection
            .getRepository(ctx, tcm_wellness_plan_entity_1.TcmWellnessPlan)
            .findOne({ where: { id: input.planId } });
        if (!plan) {
            throw new core_1.UserInputError(`康养规划不存在：${input.planId}`);
        }
        await this.staffService.assertStaffOfClinic(ctx, plan.clinicId);
        return this.wellnessService.addPlanItem(ctx, input);
    }
    async createFollowUp(ctx, input) {
        // 馆归属来自患者档案：先取档案，再守卫，最后落任务
        const profile = await this.findPatientProfile(ctx, input.patientProfileId);
        const staff = await this.staffService.assertStaffOfClinic(ctx, profile.clinicId);
        return this.wellnessService.createFollowUp(ctx, Number(staff.id), input);
    }
    async completeFollowUp(ctx, id, followUpEncounterId) {
        const taskId = Number(String(id).replace('T_', ''));
        const task = await this.connection
            .getRepository(ctx, tcm_follow_up_task_entity_1.TcmFollowUpTask)
            .findOne({ where: { id: taskId } });
        if (!task) {
            throw new core_1.UserInputError(`随访任务不存在：${taskId}`);
        }
        // 经任务的 patientProfileId → 档案的 clinicId 守卫
        const profile = await this.findPatientProfile(ctx, task.patientProfileId);
        const staff = await this.staffService.assertStaffOfClinic(ctx, profile.clinicId);
        return this.wellnessService.completeFollowUp(ctx, Number(staff.id), taskId, followUpEncounterId);
    }
    async cancelFollowUp(ctx, id) {
        const taskId = Number(String(id).replace('T_', ''));
        const task = await this.connection
            .getRepository(ctx, tcm_follow_up_task_entity_1.TcmFollowUpTask)
            .findOne({ where: { id: taskId } });
        if (!task) {
            throw new core_1.UserInputError(`随访任务不存在：${taskId}`);
        }
        const profile = await this.findPatientProfile(ctx, task.patientProfileId);
        const staff = await this.staffService.assertStaffOfClinic(ctx, profile.clinicId);
        return this.wellnessService.cancelFollowUp(ctx, Number(staff.id), taskId);
    }
    async wellnessPlans(ctx, options) {
        // 按当前 staff 所属馆过滤
        const staffList = await this.staffService.staffOf(ctx, ctx.activeUserId);
        const clinicIds = staffList.map(s => s.clinicId);
        const [items, totalItems] = await this.connection
            .getRepository(ctx, tcm_wellness_plan_entity_1.TcmWellnessPlan)
            .findAndCount({
            where: clinicIds.length ? { clinicId: (0, typeorm_1.In)(clinicIds) } : undefined,
            skip: options === null || options === void 0 ? void 0 : options.skip,
            take: options === null || options === void 0 ? void 0 : options.take,
            order: { id: 'ASC' },
        });
        return { items, totalItems };
    }
    async followUpTasks(ctx, options) {
        // 随访任务无 clinicId 列，经所属馆的患者档案过滤
        const staffList = await this.staffService.staffOf(ctx, ctx.activeUserId);
        const clinicIds = staffList.map(s => s.clinicId);
        const profiles = clinicIds.length
            ? await this.connection
                .getRepository(ctx, tcm_patient_profile_entity_1.TcmPatientProfile)
                .find({ where: { clinicId: (0, typeorm_1.In)(clinicIds) } })
            : [];
        const profileIds = profiles.map(p => p.id);
        if (!profileIds.length) {
            return { items: [], totalItems: 0 };
        }
        const [items, totalItems] = await this.connection
            .getRepository(ctx, tcm_follow_up_task_entity_1.TcmFollowUpTask)
            .findAndCount({
            where: { patientProfileId: (0, typeorm_1.In)(profileIds) },
            skip: options === null || options === void 0 ? void 0 : options.skip,
            take: options === null || options === void 0 ? void 0 : options.take,
            order: { id: 'ASC' },
        });
        return { items, totalItems };
    }
    async findPatientProfile(ctx, id) {
        const profile = await this.clinicService.findPatientProfile(ctx, id);
        if (!profile) {
            throw new core_1.UserInputError(`患者档案不存在：${id}`);
        }
        return profile;
    }
};
exports.TcmAdminResolver = TcmAdminResolver;
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "clinics", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "createClinic", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "createClinicStaff", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "createPatientProfile", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "createEncounter", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "startEncounter", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "completeEncounter", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "createMedicalRecord", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "updateMedicalRecord", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "medicalRecords", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "auditLogs", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "createWellnessPlan", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "transitionWellnessPlan", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "addPlanItem", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "createFollowUp", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('followUpEncounterId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "completeFollowUp", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "cancelFollowUp", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "wellnessPlans", null);
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TcmAdminResolver.prototype, "followUpTasks", null);
exports.TcmAdminResolver = TcmAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        tcm_clinic_service_1.TcmClinicService,
        tcm_staff_service_1.TcmStaffService,
        tcm_encounter_service_1.TcmEncounterService,
        tcm_medical_record_service_1.TcmMedicalRecordService,
        tcm_audit_service_1.TcmAuditService,
        tcm_wellness_service_1.TcmWellnessService])
], TcmAdminResolver);
//# sourceMappingURL=tcm-admin.resolver.js.map