import { RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmClinic } from '../entities/tcm-clinic.entity';
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
import { TcmEncounter } from '../entities/tcm-encounter.entity';
import { TcmFollowUpTask } from '../entities/tcm-follow-up-task.entity';
import { TcmAuditLog } from '../entities/tcm-audit-log.entity';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';
import { TcmPlanItem } from '../entities/tcm-plan-item.entity';
import { TcmWellnessPlan } from '../entities/tcm-wellness-plan.entity';
import { TcmEncounterService } from '../services/tcm-encounter.service';
import { CreateClinicInput, TcmClinicService } from '../services/tcm-clinic.service';
import { ListOptions, MedicalRecordInput, MedicalRecordView, TcmMedicalRecordService } from '../services/tcm-medical-record.service';
import { TcmAuditService } from '../services/tcm-audit.service';
import { TcmStaffService } from '../services/tcm-staff.service';
import { TcmWellnessService } from '../services/tcm-wellness.service';
export declare class TcmAdminResolver {
    private connection;
    private clinicService;
    private staffService;
    private encounterService;
    private recordService;
    private auditService;
    private wellnessService;
    constructor(connection: TransactionalConnection, clinicService: TcmClinicService, staffService: TcmStaffService, encounterService: TcmEncounterService, recordService: TcmMedicalRecordService, auditService: TcmAuditService, wellnessService: TcmWellnessService);
    clinics(ctx: RequestContext, _options: any): Promise<{
        items: TcmClinic[];
        totalItems: number;
    }>;
    createClinic(ctx: RequestContext, input: CreateClinicInput): Promise<TcmClinic>;
    createClinicStaff(ctx: RequestContext, input: {
        clinicId: number;
        administratorId: number;
        displayName: string;
        role?: string;
    }): Promise<TcmClinicStaff>;
    createPatientProfile(ctx: RequestContext, input: {
        clinicId: number;
        customerId: number;
        constitution?: Record<string, any>;
    }): Promise<TcmPatientProfile>;
    createEncounter(ctx: RequestContext, input: {
        patientProfileId: number;
        clinicId: number;
        type?: string;
    }): Promise<TcmEncounter>;
    startEncounter(ctx: RequestContext, id: string | number): Promise<TcmEncounter>;
    completeEncounter(ctx: RequestContext, id: string | number): Promise<TcmEncounter>;
    createMedicalRecord(ctx: RequestContext, input: MedicalRecordInput): Promise<MedicalRecordView>;
    updateMedicalRecord(ctx: RequestContext, id: string | number, input: Partial<MedicalRecordInput>): Promise<MedicalRecordView>;
    medicalRecords(ctx: RequestContext, options?: ListOptions): Promise<{
        items: MedicalRecordView[];
        totalItems: number;
    }>;
    auditLogs(ctx: RequestContext, options?: ListOptions): Promise<{
        items: TcmAuditLog[];
        totalItems: number;
    }>;
    createWellnessPlan(ctx: RequestContext, input: {
        patientProfileId: number;
        clinicId: number;
        title: string;
        cycleStart?: Date;
        cycleEnd?: Date;
    }): Promise<TcmWellnessPlan>;
    transitionWellnessPlan(ctx: RequestContext, id: string | number, to: 'ACTIVE' | 'PAUSED' | 'CLOSED'): Promise<TcmWellnessPlan>;
    addPlanItem(ctx: RequestContext, input: {
        planId: number;
        title: string;
        frequency?: string;
        productVariantId?: number;
    }): Promise<TcmPlanItem>;
    createFollowUp(ctx: RequestContext, input: {
        patientProfileId: number;
        planId?: number;
        title: string;
        dueAt: Date;
        channel?: string;
    }): Promise<TcmFollowUpTask>;
    completeFollowUp(ctx: RequestContext, id: string | number, followUpEncounterId?: number): Promise<TcmFollowUpTask>;
    cancelFollowUp(ctx: RequestContext, id: string | number): Promise<TcmFollowUpTask>;
    wellnessPlans(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
    }): Promise<{
        items: TcmWellnessPlan[];
        totalItems: number;
    }>;
    followUpTasks(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
    }): Promise<{
        items: TcmFollowUpTask[];
        totalItems: number;
    }>;
    private findPatientProfile;
}
