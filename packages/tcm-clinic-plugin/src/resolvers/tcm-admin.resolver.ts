import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    Customer,
    Permission,
    RequestContext,
    Transaction,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { In, MoreThanOrEqual } from 'typeorm';

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
import { ClinicScopeForbiddenError, TcmStaffService } from '../services/tcm-staff.service';
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
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async clinics(
        @Ctx() ctx: RequestContext,
        @Args('options') _options: any,
    ): Promise<{ items: TcmClinic[]; totalItems: number }> {
        const items = await this.clinicService.findAll(ctx);
        return { items, totalItems: items.length };
    }

    // 建馆/绑定员工属于租户级运维操作，无目标 clinicId 可校验，收紧为 SuperAdmin-only
    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async createClinic(@Ctx() ctx: RequestContext, @Args('input') input: CreateClinicInput): Promise<TcmClinic> {
        return this.clinicService.createClinic(ctx, input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async createClinicStaff(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { clinicId: number; administratorId: number; displayName: string; role?: string },
    ): Promise<TcmClinicStaff> {
        return this.clinicService.createClinicStaff(ctx, input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
    async createPatientProfile(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { clinicId: number; customerId: number; constitution?: Record<string, any> },
    ): Promise<TcmPatientProfile> {
        await this.staffService.assertCanWriteClinic(ctx, input.clinicId);
        // 档案跨馆共享（customerId 唯一）：已有档案属于他馆时不得把该档案「带」给非本馆员工
        const existing = await this.clinicService.findProfileByCustomerId(ctx, input.customerId);
        if (existing && Number(existing.clinicId) !== Number(input.clinicId) && !this.staffService.isSuperAdmin(ctx)) {
            throw new ClinicScopeForbiddenError('wrong-clinic', Number(existing.clinicId));
        }
        return this.clinicService.createPatientProfile(ctx, input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
    async createEncounter(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { patientProfileId: number; clinicId: number; type?: string },
    ): Promise<TcmEncounter> {
        const staffId = await this.writeStaffId(ctx, input.clinicId);
        // 接诊必须落在患者档案所属馆，防止「本馆身份 + 他馆档案」的跨馆写入
        const profile = await this.findPatientProfile(ctx, input.patientProfileId);
        if (Number(profile.clinicId) !== Number(input.clinicId)) {
            throw new ClinicScopeForbiddenError('wrong-clinic', Number(profile.clinicId));
        }
        return this.encounterService.create(ctx, input, staffId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
    async startEncounter(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmEncounter> {
        const encounterId = Number(String(id).replace('T_', ''));
        const encounter = await this.findEncounter(ctx, encounterId);
        await this.staffService.assertCanWriteClinic(ctx, Number(encounter.clinicId));
        return this.encounterService.transition(ctx, encounterId, 'ACTIVE');
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
    async completeEncounter(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmEncounter> {
        const encounterId = Number(String(id).replace('T_', ''));
        const encounter = await this.findEncounter(ctx, encounterId);
        await this.staffService.assertCanWriteClinic(ctx, Number(encounter.clinicId));
        return this.encounterService.transition(ctx, encounterId, 'COMPLETED');
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
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
        const staffId = await this.writeStaffId(ctx, Number(encounter.clinicId));
        const record = await this.recordService.create(ctx, staffId, input);
        const view = await this.recordService.decryptView(record);
        return {
            id: Number(record.id),
            encounterId: record.encounterId,
            clinicId: record.clinicId,
            version: record.version,
            ...view,
            revisions: [],
        };
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
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
        // 按记录「当前所属馆」校验（不看入参，防「传自己 clinicId 改他馆记录」）
        const staffId = await this.writeStaffId(ctx, Number(record.clinicId));
        const updated = await this.recordService.update(ctx, staffId, recordId, input);
        const view = await this.recordService.decryptView(updated);
        return {
            id: Number(updated.id),
            encounterId: updated.encounterId,
            clinicId: updated.clinicId,
            version: updated.version,
            ...view,
            revisions: [],
        };
    }

    @Transaction()
    @Query()
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async medicalRecords(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: ListOptions,
    ): Promise<{ items: MedicalRecordView[]; totalItems: number }> {
        const clinicIds = await this.clinicScope(ctx);
        return this.recordService.findAll(ctx, options, clinicIds ?? undefined);
    }

    @Transaction()
    @Query()
    @Allow(Permission.SuperAdmin)
    async auditLogs(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: ListOptions,
    ): Promise<{ items: TcmAuditLog[]; totalItems: number }> {
        // 审计日志无 clinicId，按「当前可读馆在职员工」的 staffId 过滤
        const clinicIds = await this.clinicScope(ctx);
        let staffIds: number[] | undefined;
        if (clinicIds) {
            if (!clinicIds.length) {
                return { items: [], totalItems: 0 };
            }
            const staff = await this.connection
                .getRepository(ctx, TcmClinicStaff)
                .find({ where: { clinicId: In(clinicIds) } });
            staffIds = staff.map(s => Number(s.id));
            if (!staffIds.length) {
                return { items: [], totalItems: 0 };
            }
        }
        return this.auditService.findAll(ctx, options, staffIds);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
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
        const staffId = await this.writeStaffId(ctx, input.clinicId);
        // 规划必须落在患者档案所属馆
        const profile = await this.findPatientProfile(ctx, input.patientProfileId);
        if (Number(profile.clinicId) !== Number(input.clinicId)) {
            throw new ClinicScopeForbiddenError('wrong-clinic', Number(profile.clinicId));
        }
        return this.wellnessService.createPlan(ctx, staffId, input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
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
        const staffId = await this.writeStaffId(ctx, Number(plan.clinicId));
        return this.wellnessService.transitionPlan(ctx, staffId, planId, to);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
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
        await this.staffService.assertCanWriteClinic(ctx, Number(plan.clinicId));
        return this.wellnessService.addPlanItem(ctx, input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
    async createFollowUp(
        @Ctx() ctx: RequestContext,
        @Args('input')
        input: { patientProfileId: number; planId?: number; title: string; dueAt: Date; channel?: string },
    ): Promise<TcmFollowUpTask> {
        // 馆归属来自患者档案：先取档案，再守卫，最后落任务
        const profile = await this.findPatientProfile(ctx, input.patientProfileId);
        const staffId = await this.writeStaffId(ctx, Number(profile.clinicId));
        // 关联规划必须与档案同馆，防止跨馆挂接
        if (input.planId != null) {
            const plan = await this.connection
                .getRepository(ctx, TcmWellnessPlan)
                .findOne({ where: { id: input.planId } });
            if (!plan) {
                throw new UserInputError(`康养规划不存在：${input.planId}`);
            }
            if (Number(plan.clinicId) !== Number(profile.clinicId)) {
                throw new ClinicScopeForbiddenError('wrong-clinic', Number(plan.clinicId));
            }
        }
        return this.wellnessService.createFollowUp(ctx, staffId, input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
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
        const staffId = await this.writeStaffId(ctx, Number(profile.clinicId));
        // 回写结果的接诊必须同馆
        if (followUpEncounterId != null) {
            const encounter = await this.findEncounter(ctx, Number(followUpEncounterId));
            if (Number(encounter.clinicId) !== Number(profile.clinicId)) {
                throw new ClinicScopeForbiddenError('wrong-clinic', Number(encounter.clinicId));
            }
        }
        return this.wellnessService.completeFollowUp(ctx, staffId, taskId, followUpEncounterId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.SuperAdmin)
    async cancelFollowUp(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmFollowUpTask> {
        const taskId = Number(String(id).replace('T_', ''));
        const task = await this.connection
            .getRepository(ctx, TcmFollowUpTask)
            .findOne({ where: { id: taskId } });
        if (!task) {
            throw new UserInputError(`随访任务不存在：${taskId}`);
        }
        const profile = await this.findPatientProfile(ctx, task.patientProfileId);
        const staffId = await this.writeStaffId(ctx, Number(profile.clinicId));
        return this.wellnessService.cancelFollowUp(ctx, staffId, taskId);
    }

    @Transaction()
    @Query()
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async wellnessPlans(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: { skip?: number; take?: number },
    ): Promise<{ items: TcmWellnessPlan[]; totalItems: number }> {
        // 按当前 staff 所属馆过滤（SuperAdmin 不限；无归属 → 空）
        const clinicIds = await this.clinicScope(ctx);
        if (clinicIds && !clinicIds.length) {
            return { items: [], totalItems: 0 };
        }
        const [items, totalItems] = await this.connection
            .getRepository(ctx, TcmWellnessPlan)
            .findAndCount({
                where: clinicIds ? { clinicId: In(clinicIds) } : {},
                skip: options?.skip,
                take: options?.take,
                order: { id: 'ASC' },
            });
        return { items, totalItems };
    }

    @Transaction()
    @Query()
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async followUpTasks(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: { skip?: number; take?: number },
    ): Promise<{ items: TcmFollowUpTask[]; totalItems: number }> {
        // 随访任务无 clinicId 列，经所属馆的患者档案过滤（SuperAdmin 不限；无归属 → 空）
        const clinicIds = await this.clinicScope(ctx);
        if (clinicIds && !clinicIds.length) {
            return { items: [], totalItems: 0 };
        }
        const profiles = clinicIds
            ? await this.connection
                  .getRepository(ctx, TcmPatientProfile)
                  .find({ where: { clinicId: In(clinicIds) } })
            : [];
        if (clinicIds && !profiles.length) {
            return { items: [], totalItems: 0 };
        }
        const profileIds = profiles.map(p => p.id);
        const where = clinicIds ? { patientProfileId: In(profileIds) } : {};
        const [items, totalItems] = await this.connection
            .getRepository(ctx, TcmFollowUpTask)
            .findAndCount({
                where,
                skip: options?.skip,
                take: options?.take,
                order: { id: 'ASC' },
            });
        return { items, totalItems };
    }

    @Transaction()
    @Query()
    @Allow(Permission.Authenticated)
    async myStaff(@Ctx() ctx: RequestContext): Promise<TcmClinicStaff[]> {
        return this.staffService.staffOf(ctx, ctx.activeUserId as number);
    }

    @Transaction()
    @Query()
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async patientProfiles(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: { skip?: number; take?: number },
    ): Promise<{ items: any[]; totalItems: number }> {
        const clinicIds = await this.clinicScope(ctx);
        if (clinicIds && !clinicIds.length) return { items: [], totalItems: 0 };
        const [items, totalItems] = await this.connection
            .getRepository(ctx, TcmPatientProfile)
            .findAndCount({
                where: clinicIds ? { clinicId: In(clinicIds) } : {},
                skip: options?.skip,
                take: options?.take,
                order: { id: 'ASC' },
            });
        return { items: await this.enrichProfiles(ctx, items), totalItems };
    }

    @Transaction()
    @Query()
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async patientProfile(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string | number,
    ): Promise<any | null> {
        const profile = await this.clinicService.findPatientProfile(ctx, Number(String(id).replace('T_', '')));
        if (!profile) return null;
        await this.staffService.assertCanReadClinic(ctx, Number(profile.clinicId));
        return (await this.enrichProfiles(ctx, [profile]))[0];
    }

    @Transaction()
    @Query()
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async encounters(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: { skip?: number; take?: number; since?: Date },
    ): Promise<{ items: TcmEncounter[]; totalItems: number }> {
        const clinicIds = await this.clinicScope(ctx);
        if (clinicIds && !clinicIds.length) return { items: [], totalItems: 0 };
        const [items, totalItems] = await this.connection
            .getRepository(ctx, TcmEncounter)
            .findAndCount({
                where: {
                    ...(clinicIds ? { clinicId: In(clinicIds) } : {}),
                    ...(options?.since ? { createdAt: MoreThanOrEqual(options.since) } : {}),
                },
                skip: options?.skip,
                take: options?.take,
                order: { id: 'DESC' },
            });
        return { items, totalItems };
    }

    @Transaction()
    @Query()
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async encounter(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmEncounter | null> {
        const enc = await this.connection
            .getRepository(ctx, TcmEncounter)
            .findOne({ where: { id: Number(String(id).replace('T_', '')) } });
        if (!enc) return null;
        await this.staffService.assertCanReadClinic(ctx, Number(enc.clinicId));
        return enc;
    }

    @Transaction()
    @Query()
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async medicalRecord(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<any | null> {
        const clinicIds = await this.clinicScope(ctx);
        return this.recordService.findOneView(ctx, Number(String(id).replace('T_', '')), clinicIds ?? undefined);
    }

    @Transaction()
    @Query()
    @Allow(Permission.ReadCustomer, Permission.SuperAdmin)
    async wellnessPlan(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<any | null> {
        const plan = await this.connection
            .getRepository(ctx, TcmWellnessPlan)
            .findOne({ where: { id: Number(String(id).replace('T_', '')) } });
        if (!plan) return null;
        await this.staffService.assertCanReadClinic(ctx, Number(plan.clinicId));
        const items = await this.connection.getRepository(ctx, TcmPlanItem).find({ where: { planId: Number(plan.id) }, order: { id: 'ASC' } });
        const followUps = await this.connection.getRepository(ctx, TcmFollowUpTask).find({ where: { planId: Number(plan.id) }, order: { id: 'ASC' } });
        return { ...plan, items, followUps };
    }

    private async currentClinicIds(ctx: RequestContext): Promise<number[]> {
        const staffList = await this.staffService.staffOf(ctx, ctx.activeUserId as number);
        return staffList.map(s => Number(s.clinicId));
    }

    /**
     * 写路径：先校验馆归属，再返回落审计用的 staffId。
     * SuperAdmin 未绑定该馆的员工时返回 0（表示系统级操作），不会静默跳过校验。
     */
    private async writeStaffId(ctx: RequestContext, clinicId: number): Promise<number> {
        const staff = await this.staffService.assertCanWriteClinic(ctx, clinicId);
        return staff ? Number(staff.id) : 0;
    }

    private async findEncounter(ctx: RequestContext, id: number): Promise<TcmEncounter> {
        const encounter = await this.connection
            .getRepository(ctx, TcmEncounter)
            .findOne({ where: { id } });
        if (!encounter) {
            throw new UserInputError(`接诊不存在：${id}`);
        }
        return encounter;
    }

    /**
     * 只读查询的馆范围：
     * - null  = SuperAdmin，不限馆
     * - []    = 无员工归属，调用方必须返回空（不回退成「看全部」）
     * - [..]  = 当前管理员被绑定到的馆
     */
    private async clinicScope(ctx: RequestContext): Promise<number[] | null> {
        if (this.staffService.isSuperAdmin(ctx)) {
            return null;
        }
        return this.currentClinicIds(ctx);
    }

    /** 患者档案视图增强：读时联查 Customer 姓名/手机号（无外键，仅 ID 关联） */
    private async enrichProfiles(ctx: RequestContext, profiles: TcmPatientProfile[]): Promise<any[]> {
        const customerIds = [...new Set(profiles.map(p => Number(p.customerId)))];
        const customers = customerIds.length
            ? await this.connection.getRepository(ctx, Customer).find({ where: { id: In(customerIds) } })
            : [];
        const byId = new Map(customers.map(c => [Number(c.id), c]));
        return profiles.map(p => {
            const c = byId.get(Number(p.customerId));
            return {
                id: p.id,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
                customerId: p.customerId,
                clinicId: p.clinicId,
                constitution: (p as any).constitution,
                customerName: c ? [c.firstName, c.lastName].filter(Boolean).join(' ') : `客户 ${p.customerId}`,
                customerPhone: c?.phoneNumber ?? null,
            };
        });
    }

    private async findPatientProfile(ctx: RequestContext, id: number): Promise<TcmPatientProfile> {
        const profile = await this.clinicService.findPatientProfile(ctx, id);
        if (!profile) {
            throw new UserInputError(`患者档案不存在：${id}`);
        }
        return profile;
    }
}
