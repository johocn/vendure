import { ForbiddenError, RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
/**
 * 馆归属拒绝（沿用 FORBIDDEN 错误码，但换成可区分/可解释的 i18n 文案）：
 * - not-bound    账号未绑定任何诊所
 * - wrong-clinic 账号不属于目标诊所
 * 文案在 plugin bootstrap 阶段注册进 I18nService。
 */
export declare class ClinicScopeForbiddenError extends ForbiddenError {
    constructor(reason: 'not-bound' | 'wrong-clinic', clinicId?: number);
}
export declare class TcmStaffService {
    private connection;
    constructor(connection: TransactionalConnection);
    /**
     * ctx.activeUserId 是 user id，而 tcm_clinic_staff.administratorId 存的是 administrator id，
     * 两者只有在极小库中才恰好相等（fixture 未暴露此 bug），必须先经 administrator 表映射。
     */
    private administratorIdOf;
    /** 取当前管理员在指定馆的员工身份；非本馆员工抛 Forbidden */
    assertStaffOfClinic(ctx: RequestContext, clinicId: number): Promise<TcmClinicStaff>;
    /** 当前请求是否超级管理员（SuperAdmin 权限保留跨馆全量读取） */
    isSuperAdmin(ctx: RequestContext): boolean;
    /** 只读路径的馆归属校验：SuperAdmin 放行，其余必须是该馆员工（否则 Forbidden） */
    assertCanReadClinic(ctx: RequestContext, clinicId: number): Promise<void>;
    /**
     * 写路径的馆归属校验。
     * - SuperAdmin：可写全量，返回其在该馆的员工绑定（未绑定时为 null，审计 staffId 以 0 兜底）
     * - 普通账号：必须绑定该馆，否则抛 ClinicScopeForbiddenError（区分「未绑定任何诊所」/「不属于该馆」）
     */
    assertCanWriteClinic(ctx: RequestContext, clinicId: number): Promise<TcmClinicStaff | null>;
    staffOf(ctx: RequestContext, userId: number): Promise<TcmClinicStaff[]>;
}
