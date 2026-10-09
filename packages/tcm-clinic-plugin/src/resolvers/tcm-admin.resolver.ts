import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction, TransactionalConnection, UserInputError } from '@vendure/core';

import { TcmClinic } from '../entities/tcm-clinic.entity';
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
import { TcmEncounter } from '../entities/tcm-encounter.entity';
import { TcmMedicalRecord } from '../entities/tcm-medical-record.entity';
import { TcmAuditLog } from '../entities/tcm-audit-log.entity';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';
import { TcmEncounterService } from '../services/tcm-encounter.service';
import { CreateClinicInput, TcmClinicService } from '../services/tcm-clinic.service';
import {
    ListOptions,
    MedicalRecordInput,
    MedicalRecordView,
    TcmMedicalRecordService,
} from '../services/tcm-medical-record.service';
import { TcmAuditService } from '../services/tcm-audit.service';
import { TcmStaffService } from '../services/tcm-staff.service';

@Resolver()
export class TcmAdminResolver {
    constructor(
        private connection: TransactionalConnection,
        private clinicService: TcmClinicService,
        private staffService: TcmStaffService,
        private encounterService: TcmEncounterService,
        private recordService: TcmMedicalRecordService,
        private auditService: TcmAuditService,
    ) {}

    @Transaction()
    @Query()
    async clinics(
        @Ctx() ctx: RequestContext,
        @Args('options') _options: any,
    ): Promise<{ items: TcmClinic[]; totalItems: number }> {
        const items = await this.clinicService.findAll(ctx);
        return { items, totalItems: items.length };
    }

    @Transaction()
    @Mutation()
    async createClinic(@Ctx() ctx: RequestContext, @Args('input') input: CreateClinicInput): Promise<TcmClinic> {
        return this.clinicService.createClinic(ctx, input);
    }

    @Transaction()
    @Mutation()
    async createClinicStaff(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { clinicId: number; administratorId: number; displayName: string; role?: string },
    ): Promise<TcmClinicStaff> {
        return this.clinicService.createClinicStaff(ctx, input);
    }

    @Transaction()
    @Mutation()
    async createPatientProfile(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { clinicId: number; customerId: number; constitution?: Record<string, any> },
    ): Promise<TcmPatientProfile> {
        await this.staffService.assertStaffOfClinic(ctx, input.clinicId);
        return this.clinicService.createPatientProfile(ctx, input);
    }

    @Transaction()
    @Mutation()
    async createEncounter(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { patientProfileId: number; clinicId: number; type?: string },
    ): Promise<TcmEncounter> {
        const staff = await this.staffService.assertStaffOfClinic(ctx, input.clinicId);
        return this.encounterService.create(ctx, input, staff.id);
    }

    @Transaction()
    @Mutation()
    async startEncounter(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmEncounter> {
        return this.encounterService.transition(ctx, Number(String(id).replace('T_', '')), 'ACTIVE');
    }

    @Transaction()
    @Mutation()
    async completeEncounter(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmEncounter> {
        return this.encounterService.transition(ctx, Number(String(id).replace('T_', '')), 'COMPLETED');
    }

    @Transaction()
    @Mutation()
    async createMedicalRecord(
        @Ctx() ctx: RequestContext,
        @Args('input') input: MedicalRecordInput,
    ): Promise<MedicalRecordView> {
        // 馆归属来自 encounter：先取 encounter，再守卫，最后落记录
        const encounter = await this.connection
            .getRepository(ctx, TcmEncounter)
            .findOne({ where: { id: input.encounterId } });
        if (!encounter) {
            throw new UserInputError(`接诊不存在：${input.encounterId}`);
        }
        const staff = await this.staffService.assertStaffOfClinic(ctx, encounter.clinicId);
        const record = await this.recordService.create(ctx, staff.id, input);
        const view = await this.recordService.decryptView(record);
        return { id: record.id, encounterId: record.encounterId, version: record.version, ...view, revisions: [] };
    }

    @Transaction()
    @Mutation()
    async updateMedicalRecord(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string | number,
        @Args('input') input: Partial<MedicalRecordInput>,
    ): Promise<MedicalRecordView> {
        const recordId = Number(String(id).replace('T_', ''));
        const record = await this.connection
            .getRepository(ctx, TcmMedicalRecord)
            .findOne({ where: { id: recordId } });
        if (!record) {
            throw new UserInputError(`病志不存在：${recordId}`);
        }
        // 经病志的 encounterId 取 encounter → 校验馆归属
        const encounter = await this.connection
            .getRepository(ctx, TcmEncounter)
            .findOne({ where: { id: record.encounterId } });
        if (!encounter) {
            throw new UserInputError(`接诊不存在：${record.encounterId}`);
        }
        const staff = await this.staffService.assertStaffOfClinic(ctx, encounter.clinicId);
        const updated = await this.recordService.update(ctx, staff.id, recordId, input);
        const view = await this.recordService.decryptView(updated);
        return { id: updated.id, encounterId: updated.encounterId, version: updated.version, ...view, revisions: [] };
    }

    @Transaction()
    @Query()
    async medicalRecords(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: ListOptions,
    ): Promise<{ items: MedicalRecordView[]; totalItems: number }> {
        return this.recordService.findAll(ctx, options);
    }

    @Transaction()
    @Query()
    async auditLogs(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: ListOptions,
    ): Promise<{ items: TcmAuditLog[]; totalItems: number }> {
        return this.auditService.findAll(ctx, options);
    }
}
