import { RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmCryptoService } from '../crypto/tcm-crypto.service';
import { TcmFollowUpTask } from '../entities/tcm-follow-up-task.entity';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';
import { TcmPlanItem } from '../entities/tcm-plan-item.entity';
import { TcmWellnessPlan } from '../entities/tcm-wellness-plan.entity';
import { TcmClinicService } from '../services/tcm-clinic.service';
import { TcmWellnessService } from '../services/tcm-wellness.service';
export declare class TcmShopResolver {
    private connection;
    private clinicService;
    private wellnessService;
    private crypto;
    constructor(connection: TransactionalConnection, clinicService: TcmClinicService, wellnessService: TcmWellnessService, crypto: TcmCryptoService);
    /** 归属校验：ctx.activeUserId → Customer → PatientProfile.customerId 必须一致 */
    private assertOwnProfile;
    myPatientProfile(ctx: RequestContext): Promise<TcmPatientProfile>;
    /** 病志列表：解密 diagnosis 后截前 20 字符作为脱敏摘要，绝不返回 *Enc/prescription 原文 */
    myMedicalRecords(ctx: RequestContext, skip?: number, take?: number): Promise<{
        items: Array<{
            id: number;
            version: number;
            diagnosisSummary: string;
            createdAt: Date;
        }>;
        totalItems: number;
    }>;
    /** 本人 ACTIVE 且最新的康养规划（含计划项） */
    myWellnessPlan(ctx: RequestContext): Promise<(TcmWellnessPlan & {
        items: TcmPlanItem[];
    }) | null>;
    /** 本人待办随访（PENDING，按 dueAt 升序） */
    myFollowUps(ctx: RequestContext): Promise<TcmFollowUpTask[]>;
}
