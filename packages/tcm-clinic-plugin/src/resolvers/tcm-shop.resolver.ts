import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ForbiddenError, RequestContext, Transaction, TransactionalConnection } from '@vendure/core';

import { TcmCryptoService } from '../crypto/tcm-crypto.service';
import { TcmFollowUpTask } from '../entities/tcm-follow-up-task.entity';
import { TcmMedicalRecord } from '../entities/tcm-medical-record.entity';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';
import { TcmPlanItem } from '../entities/tcm-plan-item.entity';
import { TcmWellnessPlan } from '../entities/tcm-wellness-plan.entity';
import { TcmClinicService } from '../services/tcm-clinic.service';
import { TcmWellnessService } from '../services/tcm-wellness.service';

@Resolver()
export class TcmShopResolver {
    constructor(
        private connection: TransactionalConnection,
        private clinicService: TcmClinicService,
        private wellnessService: TcmWellnessService,
        private crypto: TcmCryptoService,
    ) {}

    /** 归属校验：ctx.activeUserId → Customer → PatientProfile.customerId 必须一致 */
    private async assertOwnProfile(ctx: RequestContext): Promise<TcmPatientProfile> {
        if (!ctx.activeUserId) {
            throw new ForbiddenError();
        }
        const customer = await this.clinicService.findCustomerByUserId(ctx, ctx.activeUserId as number);
        if (!customer) {
            throw new ForbiddenError();
        }
        const profile = await this.clinicService.findProfileByCustomerId(ctx, Number(customer.id));
        if (!profile) {
            throw new ForbiddenError();
        }
        return profile;
    }

    @Transaction()
    @Query()
    async myPatientProfile(@Ctx() ctx: RequestContext): Promise<TcmPatientProfile> {
        return this.assertOwnProfile(ctx);
    }

    /** 病志列表：解密 diagnosis 后截前 20 字符作为脱敏摘要，绝不返回 *Enc/prescription 原文 */
    @Transaction()
    @Query()
    async myMedicalRecords(
        @Ctx() ctx: RequestContext,
        @Args('skip') skip?: number,
        @Args('take') take?: number,
    ): Promise<{
        items: Array<{ id: number; version: number; diagnosisSummary: string; createdAt: Date }>;
        totalItems: number;
    }> {
        const profile = await this.assertOwnProfile(ctx);
        const [rows, total] = await this.connection
            .getRepository(ctx, TcmMedicalRecord)
            .findAndCount({
                where: { patientProfileId: Number(profile.id) },
                order: { id: 'DESC' },
                skip,
                take: take ?? 10,
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
    @Transaction()
    @Query()
    async myWellnessPlan(
        @Ctx() ctx: RequestContext,
    ): Promise<(TcmWellnessPlan & { items: TcmPlanItem[] }) | null> {
        const profile = await this.assertOwnProfile(ctx);
        const plan = await this.connection.getRepository(ctx, TcmWellnessPlan).findOne({
            where: { patientProfileId: Number(profile.id), status: 'ACTIVE' },
            order: { id: 'DESC' },
        });
        if (!plan) {
            return null;
        }
        const items = await this.wellnessService.itemsOfPlan(ctx, Number(plan.id));
        return { ...plan, items };
    }

    /** 本人待办随访（PENDING，按 dueAt 升序） */
    @Transaction()
    @Query()
    async myFollowUps(@Ctx() ctx: RequestContext): Promise<TcmFollowUpTask[]> {
        const profile = await this.assertOwnProfile(ctx);
        return this.connection.getRepository(ctx, TcmFollowUpTask).find({
            where: { patientProfileId: Number(profile.id), status: 'PENDING' },
            order: { dueAt: 'ASC' },
        });
    }
}
