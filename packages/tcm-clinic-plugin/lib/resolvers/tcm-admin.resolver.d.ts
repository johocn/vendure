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
    myStaff(ctx: RequestContext): Promise<TcmClinicStaff[]>;
    patientProfiles(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
    }): Promise<{
        items: any[];
        totalItems: number;
    }>;
    patientProfile(ctx: RequestContext, id: string | number): Promise<any | null>;
    encounters(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
        since?: Date;
    }): Promise<{
        items: TcmEncounter[];
        totalItems: number;
    }>;
    encounter(ctx: RequestContext, id: string | number): Promise<TcmEncounter | null>;
    medicalRecord(ctx: RequestContext, id: string | number): Promise<any | null>;
    wellnessPlan(ctx: RequestContext, id: string | number): Promise<any | null>;
    private currentClinicIds;
    /**
     * 写路径：先校验馆归属，再返回落审计用的 staffId。
     * SuperAdmin 未绑定该馆的员工时返回 0（表示系统级操作），不会静默跳过校验。
     */
    private writeStaffId;
    private findEncounter;
    /**
     * 只读查询的馆范围：
     * - null  = SuperAdmin，不限馆
     * - []    = 无员工归属，调用方必须返回空（不回退成「看全部」）
     * - [..]  = 当前管理员被绑定到的馆
     */
    private clinicScope;
    /** 患者档案视图增强：读时联查 Customer 姓名/手机号（无外键，仅 ID 关联） */
    private enrichProfiles;
    private findPatientProfile;
}
