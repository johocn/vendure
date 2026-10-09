import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { TCM_PLUGIN_OPTIONS } from './constants';
import { TcmClinic } from './entities/tcm-clinic.entity';
import { TcmClinicStaff } from './entities/tcm-clinic-staff.entity';
import { TcmEncounter } from './entities/tcm-encounter.entity';
import { TcmFollowUpTask } from './entities/tcm-follow-up-task.entity';
import { TcmMedicalRecord } from './entities/tcm-medical-record.entity';
import { TcmMedicalRecordRevision } from './entities/tcm-medical-record-revision.entity';
import { TcmAuditLog } from './entities/tcm-audit-log.entity';
import { TcmPatientProfile } from './entities/tcm-patient-profile.entity';
import { TcmPlanItem } from './entities/tcm-plan-item.entity';
import { TcmWellnessPlan } from './entities/tcm-wellness-plan.entity';
import { TcmAdminResolver } from './resolvers/tcm-admin.resolver';
import { TcmAuditService } from './services/tcm-audit.service';
import { TcmClinicService } from './services/tcm-clinic.service';
import { TcmCryptoService } from './crypto/tcm-crypto.service';
import { TcmEncounterService } from './services/tcm-encounter.service';
import { TcmMedicalRecordService } from './services/tcm-medical-record.service';
import { TcmStaffService } from './services/tcm-staff.service';
import { TcmWellnessService } from './services/tcm-wellness.service';
import { TcmClinicPluginOptions } from './types';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
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

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [
        TcmClinic,
        TcmClinicStaff,
        TcmPatientProfile,
        TcmEncounter,
        TcmMedicalRecord,
        TcmMedicalRecordRevision,
        TcmAuditLog,
        TcmWellnessPlan,
        TcmPlanItem,
        TcmFollowUpTask,
    ],
    providers: [
        { provide: TCM_PLUGIN_OPTIONS, useFactory: () => TcmClinicPlugin.options },
        TcmClinicService,
        TcmStaffService,
        TcmEncounterService,
        TcmCryptoService,
        TcmAuditService,
        TcmMedicalRecordService,
        TcmWellnessService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [TcmAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class TcmClinicPlugin {
    static options: TcmClinicPluginOptions = {};

    static init(options?: TcmClinicPluginOptions): Type<TcmClinicPlugin> {
        TcmClinicPlugin.options = options ?? {};
        return TcmClinicPlugin;
    }
}
