import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction, TransactionalConnection, UserInputError } from '@vendure/core';
import { In } from 'typeorm';

import { TcmClinic } from '../entities/tcm-clinic.entity';
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
import { TcmEncounter } from '../entities/tcm-encounter.entity';
import { TcmFollowUpTask } from '../entities/tcm-follow-up-task.entity';
import { TcmMedicalRecord } from '../entities/tcm-medical-record.entity';
import { TcmAuditLog } from '../entities/tcm-audit-log.entity';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';
import { TcmPlanItem } from '../entities/tcm-plan-item.entity';
import { TcmWellnessPlan } from '../entities/tcm-wellness-plan.entity';
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
import { TcmWellnessService } from '../services/tcm-wellness.service';

@Resolver()
export class TcmAdminResolver {
    constructor(
        private connection: TransactionalConnection,
        private clinicService: TcmClinicService,
        private staffService: TcmStaffService,
        private encounterService: TcmEncounterService,
        private recordService: TcmMedicalRecordService,
        private auditService: TcmAuditService,
        private wellnessService: TcmWellnessService,
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

    @Transaction()
    @Mutation()
    async createWellnessPlan(
        @Ctx() ctx: RequestContext,
        @Args('input')
        input: {
            patientProfileId: number;
            clinicId: number;
            title: string;
            cycleStart?: Date;
            cycleEnd?: Date;
        },
    ): Promise<TcmWellnessPlan> {
        const staff = await this.staffService.assertStaffOfClinic(ctx, input.clinicId);
        return this.wellnessService.createPlan(ctx, staff.id, input);
    }

    @Transaction()
    @Mutation()
    async transitionWellnessPlan(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string | number,
        @Args('to') to: 'ACTIVE' | 'PAUSED' | 'CLOSED',
    ): Promise<TcmWellnessPlan> {
        const planId = Number(String(id).replace('T_', ''));
        const plan = await this.connection
            .getRepository(ctx, TcmWellnessPlan)
            .findOne({ where: { id: planId } });
        if (!plan) {
            throw new UserInputError(`康养规划不存在：${planId}`);
        }
        const staff = await this.staffService.assertStaffOfClinic(ctx, plan.clinicId);
        return this.wellnessService.transitionPlan(ctx, staff.id, planId, to);
    }

    @Transaction()
    @Mutation()
    async addPlanItem(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { planId: number; title: string; frequency?: string; productVariantId?: number },
    ): Promise<TcmPlanItem> {
        // 馆归属来自 plan：先取 plan，再守卫，最后落计划项
        const plan = await this.connection
            .getRepository(ctx, TcmWellnessPlan)
            .findOne({ where: { id: input.planId } });
        if (!plan) {
            throw new UserInputError(`康养规划不存在：${input.planId}`);
        }
        await this.staffService.assertStaffOfClinic(ctx, plan.clinicId);
        return this.wellnessService.addPlanItem(ctx, input);
    }

    @Transaction()
    @Mutation()
    async createFollowUp(
        @Ctx() ctx: RequestContext,
        @Args('input')
        input: { patientProfileId: number; planId?: number; title: string; dueAt: Date; channel?: string },
    ): Promise<TcmFollowUpTask> {
        // 馆归属来自患者档案：先取档案，再守卫，最后落任务
        const profile = await this.findPatientProfile(ctx, input.patientProfileId);
        const staff = await this.staffService.assertStaffOfClinic(ctx, profile.clinicId);
        return this.wellnessService.createFollowUp(ctx, staff.id, input);
    }

    @Transaction()
    @Mutation()
    async completeFollowUp(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string | number,
        @Args('followUpEncounterId') followUpEncounterId?: number,
    ): Promise<TcmFollowUpTask> {
        const taskId = Number(String(id).replace('T_', ''));
        const task = await this.connection
            .getRepository(ctx, TcmFollowUpTask)
            .findOne({ where: { id: taskId } });
        if (!task) {
            throw new UserInputError(`随访任务不存在：${taskId}`);
        }
        // 经任务的 patientProfileId → 档案的 clinicId 守卫
        const profile = await this.findPatientProfile(ctx, task.patientProfileId);
        const staff = await this.staffService.assertStaffOfClinic(ctx, profile.clinicId);
        return this.wellnessService.completeFollowUp(ctx, staff.id, taskId, followUpEncounterId);
    }

    @Transaction()
    @Mutation()
    async cancelFollowUp(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmFollowUpTask> {
        const taskId = Number(String(id).replace('T_', ''));
        const task = await this.connection
            .getRepository(ctx, TcmFollowUpTask)
            .findOne({ where: { id: taskId } });
        if (!task) {
            throw new UserInputError(`随访任务不存在：${taskId}`);
        }
        const profile = await this.findPatientProfile(ctx, task.patientProfileId);
        const staff = await this.staffService.assertStaffOfClinic(ctx, profile.clinicId);
        return this.wellnessService.cancelFollowUp(ctx, staff.id, taskId);
    }

    @Transaction()
    @Query()
    async wellnessPlans(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: { skip?: number; take?: number },
    ): Promise<{ items: TcmWellnessPlan[]; totalItems: number }> {
        // 按当前 staff 所属馆过滤
        const staffList = await this.staffService.staffOf(ctx, ctx.activeUserId as number);
        const clinicIds = staffList.map(s => s.clinicId);
        const [items, totalItems] = await this.connection
            .getRepository(ctx, TcmWellnessPlan)
            .findAndCount({
                where: clinicIds.length ? { clinicId: In(clinicIds) } : undefined,
                skip: options?.skip,
                take: options?.take,
                order: { id: 'ASC' },
            });
        return { items, totalItems };
    }

    @Transaction()
    @Query()
    async followUpTasks(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: { skip?: number; take?: number },
    ): Promise<{ items: TcmFollowUpTask[]; totalItems: number }> {
        // 随访任务无 clinicId 列，经所属馆的患者档案过滤
        const staffList = await this.staffService.staffOf(ctx, ctx.activeUserId as number);
        const clinicIds = staffList.map(s => s.clinicId);
        const profiles = clinicIds.length
            ? await this.connection
                  .getRepository(ctx, TcmPatientProfile)
                  .find({ where: { clinicId: In(clinicIds) } })
            : [];
        const profileIds = profiles.map(p => p.id);
        if (!profileIds.length) {
            return { items: [], totalItems: 0 };
        }
        const [items, totalItems] = await this.connection
            .getRepository(ctx, TcmFollowUpTask)
            .findAndCount({
                where: { patientProfileId: In(profileIds) },
                skip: options?.skip,
                take: options?.take,
                order: { id: 'ASC' },
            });
        return { items, totalItems };
    }

    private async findPatientProfile(ctx: RequestContext, id: number): Promise<TcmPatientProfile> {
        const profile = await this.clinicService.findPatientProfile(ctx, id);
        if (!profile) {
            throw new UserInputError(`患者档案不存在：${id}`);
        }
        return profile;
    }
}
