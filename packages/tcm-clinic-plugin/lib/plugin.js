"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TcmClinicPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcmClinicPlugin = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const tcm_clinic_entity_1 = require("./entities/tcm-clinic.entity");
const tcm_clinic_staff_entity_1 = require("./entities/tcm-clinic-staff.entity");
const tcm_encounter_entity_1 = require("./entities/tcm-encounter.entity");
const tcm_follow_up_task_entity_1 = require("./entities/tcm-follow-up-task.entity");
const tcm_medical_record_entity_1 = require("./entities/tcm-medical-record.entity");
const tcm_medical_record_revision_entity_1 = require("./entities/tcm-medical-record-revision.entity");
const tcm_audit_log_entity_1 = require("./entities/tcm-audit-log.entity");
const tcm_patient_profile_entity_1 = require("./entities/tcm-patient-profile.entity");
const tcm_plan_item_entity_1 = require("./entities/tcm-plan-item.entity");
const tcm_wellness_plan_entity_1 = require("./entities/tcm-wellness-plan.entity");
const tcm_admin_resolver_1 = require("./resolvers/tcm-admin.resolver");
const tcm_shop_resolver_1 = require("./resolvers/tcm-shop.resolver");
const tcm_audit_service_1 = require("./services/tcm-audit.service");
const tcm_clinic_service_1 = require("./services/tcm-clinic.service");
const tcm_crypto_service_1 = require("./crypto/tcm-crypto.service");
const tcm_encounter_service_1 = require("./services/tcm-encounter.service");
const tcm_medical_record_service_1 = require("./services/tcm-medical-record.service");
const tcm_staff_service_1 = require("./services/tcm-staff.service");
const tcm_wellness_service_1 = require("./services/tcm-wellness.service");
const { gql } = require('graphql-tag');
/**
 * Shop API（患者端）：输出类型均不含 *Enc/prescription 等加密字段，
 * 病志仅暴露脱敏摘要 diagnosisSummary。
 */
const shopSchema = () => gql `
    type TcmPatientProfileView {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        customerId: ID!
        clinicId: ID!
        constitution: JSON
    }
    type TcmMedicalRecordSummary {
        id: ID!
        version: Int!
        diagnosisSummary: String!
        createdAt: DateTime!
    }
    type TcmMedicalRecordSummaryList {
        items: [TcmMedicalRecordSummary!]!
        totalItems: Int!
    }
    type TcmPlanItemView {
        id: ID!
        title: String!
        frequency: String
        productVariantId: ID
        orderId: ID
    }
    type TcmWellnessPlanView {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        title: String!
        status: WellnessPlanStatus!
        cycleStart: DateTime
        cycleEnd: DateTime
        items: [TcmPlanItemView!]!
    }
    type TcmFollowUpView {
        id: ID!
        title: String!
        status: FollowUpStatus!
        dueAt: DateTime!
    }
    enum WellnessPlanStatus {
        DRAFT
        ACTIVE
        PAUSED
        CLOSED
    }
    enum FollowUpStatus {
        PENDING
        DONE
        CANCELED
    }
    extend type Query {
        myPatientProfile: TcmPatientProfileView!
        myMedicalRecords(skip: Int, take: Int): TcmMedicalRecordSummaryList!
        myWellnessPlan: TcmWellnessPlanView
        myFollowUps: [TcmFollowUpView!]!
    }
`;
const adminSchema = () => gql `
    type TcmClinic {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        name: String!
        licenseNo: String!
        address: String
        status: String!
    }
    input TcmClinicInput {
        name: String!
        licenseNo: String!
        address: String
    }
    extend type Query {
        clinics(options: TcmClinicListOptions): TcmClinicList!
        medicalRecords(options: MedicalRecordListOptions): MedicalRecordList!
        auditLogs(options: AuditLogListOptions): AuditLogList!
        wellnessPlans(options: TcmWellnessPlanListOptions): TcmWellnessPlanList!
        followUpTasks(options: TcmFollowUpTaskListOptions): TcmFollowUpTaskList!
    }
    input TcmClinicListOptions {
        skip: Int
        take: Int
    }
    type TcmClinicList {
        items: [TcmClinic!]!
        totalItems: Int!
    }
    type TcmClinicStaff {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        administratorId: ID!
        clinicId: ID!
        role: String!
        displayName: String!
    }
    input TcmClinicStaffInput {
        clinicId: Int!
        administratorId: Int!
        displayName: String!
        role: String
    }
    type TcmPatientProfile {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        customerId: ID!
        clinicId: ID!
        constitution: JSON
    }
    input TcmPatientProfileInput {
        clinicId: Int!
        customerId: Int!
        constitution: JSON
    }
    type TcmEncounter {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        patientProfileId: ID!
        clinicId: ID!
        staffId: ID!
        type: String!
        status: String!
        version: Int!
    }
    input TcmEncounterInput {
        patientProfileId: Int!
        clinicId: Int!
        type: String
    }
    type TcmMedicalRecordRevisionView {
        version: Int!
        editedByStaffId: ID!
        createdAt: DateTime!
    }
    type MedicalRecordView {
        id: ID!
        encounterId: ID!
        clinicId: ID!
        version: Int!
        chiefComplaint: String!
        diagnosis: String!
        prescription: JSON!
        revisions: [TcmMedicalRecordRevisionView!]!
    }
    input MedicalRecordInput {
        encounterId: Int!
        chiefComplaint: String!
        diagnosis: String!
        prescription: JSON
    }
    input UpdateMedicalRecordInput {
        chiefComplaint: String
        diagnosis: String
        prescription: JSON
    }
    input MedicalRecordListOptions {
        skip: Int
        take: Int
    }
    type MedicalRecordList {
        items: [MedicalRecordView!]!
        totalItems: Int!
    }
    type TcmAuditLogView {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        entityType: String!
        entityId: ID!
        staffId: ID!
        action: String!
        diff: JSON
    }
    input AuditLogListOptions {
        skip: Int
        take: Int
    }
    type AuditLogList {
        items: [TcmAuditLogView!]!
        totalItems: Int!
    }
    enum WellnessPlanStatus {
        DRAFT
        ACTIVE
        PAUSED
        CLOSED
    }
    enum FollowUpStatus {
        PENDING
        DONE
        CANCELED
    }
    type TcmWellnessPlan {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        patientProfileId: ID!
        clinicId: ID!
        title: String!
        status: WellnessPlanStatus!
        cycleStart: DateTime
        cycleEnd: DateTime
    }
    input TcmWellnessPlanInput {
        patientProfileId: Int!
        clinicId: Int!
        title: String!
        cycleStart: DateTime
        cycleEnd: DateTime
    }
    type TcmPlanItem {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        planId: ID!
        title: String!
        frequency: String
        productVariantId: ID
        orderId: ID
    }
    input TcmPlanItemInput {
        planId: Int!
        title: String!
        frequency: String
        productVariantId: Int
    }
    type TcmFollowUpTask {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        patientProfileId: ID!
        planId: ID
        title: String!
        dueAt: DateTime!
        channel: String!
        status: FollowUpStatus!
        followUpEncounterId: ID
    }
    input TcmFollowUpTaskInput {
        patientProfileId: Int!
        planId: Int
        title: String!
        dueAt: DateTime!
        channel: String
    }
    input TcmWellnessPlanListOptions {
        skip: Int
        take: Int
    }
    type TcmWellnessPlanList {
        items: [TcmWellnessPlan!]!
        totalItems: Int!
    }
    input TcmFollowUpTaskListOptions {
        skip: Int
        take: Int
    }
    type TcmFollowUpTaskList {
        items: [TcmFollowUpTask!]!
        totalItems: Int!
    }
    extend type Mutation {
        createClinic(input: TcmClinicInput!): TcmClinic!
        createClinicStaff(input: TcmClinicStaffInput!): TcmClinicStaff!
        createPatientProfile(input: TcmPatientProfileInput!): TcmPatientProfile!
        createEncounter(input: TcmEncounterInput!): TcmEncounter!
        startEncounter(id: ID!): TcmEncounter!
        completeEncounter(id: ID!): TcmEncounter!
        createMedicalRecord(input: MedicalRecordInput!): MedicalRecordView!
        updateMedicalRecord(id: ID!, input: UpdateMedicalRecordInput!): MedicalRecordView!
        createWellnessPlan(input: TcmWellnessPlanInput!): TcmWellnessPlan!
        transitionWellnessPlan(id: ID!, to: WellnessPlanStatus!): TcmWellnessPlan!
        addPlanItem(input: TcmPlanItemInput!): TcmPlanItem!
        createFollowUp(input: TcmFollowUpTaskInput!): TcmFollowUpTask!
        completeFollowUp(id: ID!, followUpEncounterId: Int): TcmFollowUpTask!
        cancelFollowUp(id: ID!): TcmFollowUpTask!
    }
`;
let TcmClinicPlugin = TcmClinicPlugin_1 = class TcmClinicPlugin {
    static init(options) {
        TcmClinicPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return TcmClinicPlugin_1;
    }
};
exports.TcmClinicPlugin = TcmClinicPlugin;
TcmClinicPlugin.options = {};
exports.TcmClinicPlugin = TcmClinicPlugin = TcmClinicPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [
            tcm_clinic_entity_1.TcmClinic,
            tcm_clinic_staff_entity_1.TcmClinicStaff,
            tcm_patient_profile_entity_1.TcmPatientProfile,
            tcm_encounter_entity_1.TcmEncounter,
            tcm_medical_record_entity_1.TcmMedicalRecord,
            tcm_medical_record_revision_entity_1.TcmMedicalRecordRevision,
            tcm_audit_log_entity_1.TcmAuditLog,
            tcm_wellness_plan_entity_1.TcmWellnessPlan,
            tcm_plan_item_entity_1.TcmPlanItem,
            tcm_follow_up_task_entity_1.TcmFollowUpTask,
        ],
        providers: [
            { provide: constants_1.TCM_PLUGIN_OPTIONS, useFactory: () => TcmClinicPlugin.options },
            tcm_clinic_service_1.TcmClinicService,
            tcm_staff_service_1.TcmStaffService,
            tcm_encounter_service_1.TcmEncounterService,
            tcm_crypto_service_1.TcmCryptoService,
            tcm_audit_service_1.TcmAuditService,
            tcm_medical_record_service_1.TcmMedicalRecordService,
            tcm_wellness_service_1.TcmWellnessService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [tcm_admin_resolver_1.TcmAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [tcm_shop_resolver_1.TcmShopResolver],
        },
        compatibility: '^3.0.0',
    })
], TcmClinicPlugin);
//# sourceMappingURL=plugin.js.map