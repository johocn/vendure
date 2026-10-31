import { Injectable } from '@nestjs/common';
import { Administrator, ForbiddenError, Permission, RequestContext, TransactionalConnection } from '@vendure/core';

import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';

/**
 * 馆归属拒绝（沿用 FORBIDDEN 错误码，但换成可区分/可解释的 i18n 文案）：
 * - not-bound    账号未绑定任何诊所
 * - wrong-clinic 账号不属于目标诊所
 * 文案在 plugin bootstrap 阶段注册进 I18nService。
 */
export class ClinicScopeForbiddenError extends ForbiddenError {
    constructor(reason: 'not-bound' | 'wrong-clinic', clinicId?: number) {
        super();
        this.message = reason === 'not-bound' ? 'error.tcm-account-not-bound' : 'error.tcm-clinic-access-denied';
        this.variables = clinicId == null ? {} : { clinicId };
    }
}

@Injectable()
export class TcmStaffService {
    constructor(private connection: TransactionalConnection) {}

    /**
     * ctx.activeUserId 是 user id，而 tcm_clinic_staff.administratorId 存的是 administrator id，
     * 两者只有在极小库中才恰好相等（fixture 未暴露此 bug），必须先经 administrator 表映射。
     */
    private async administratorIdOf(ctx: RequestContext, userId: number): Promise<number | null> {
        const admin = await this.connection
            .getRepository(ctx, Administrator)
            .findOne({ where: { user: { id: userId } } });
        return admin ? (admin.id as number) : null;
    }

    /** 取当前管理员在指定馆的员工身份；非本馆员工抛 Forbidden */
    async assertStaffOfClinic(ctx: RequestContext, clinicId: number): Promise<TcmClinicStaff> {
        const administratorId = await this.administratorIdOf(ctx, ctx.activeUserId as number);
        if (administratorId === null) {
            throw new ForbiddenError();
        }
        const staff = await this.connection
            .getRepository(ctx, TcmClinicStaff)
            .findOne({ where: { administratorId, clinicId } });
        if (!staff) {
            // ForbiddenError 基于 i18n 固定文案，不支持自定义消息
            throw new ForbiddenError();
        }
        return staff;
    }

    /** 当前请求是否超级管理员（SuperAdmin 权限保留跨馆全量读取） */
    isSuperAdmin(ctx: RequestContext): boolean {
        return ctx.userHasPermissions([Permission.SuperAdmin]);
    }

    /** 只读路径的馆归属校验：SuperAdmin 放行，其余必须是该馆员工（否则 Forbidden） */
    async assertCanReadClinic(ctx: RequestContext, clinicId: number): Promise<void> {
        if (this.isSuperAdmin(ctx)) {
            return;
        }
        await this.assertStaffOfClinic(ctx, clinicId);
    }

    /**
     * 写路径的馆归属校验。
     * - SuperAdmin：可写全量，返回其在该馆的员工绑定（未绑定时为 null，审计 staffId 以 0 兜底）
     * - 普通账号：必须绑定该馆，否则抛 ClinicScopeForbiddenError（区分「未绑定任何诊所」/「不属于该馆」）
     */
    async assertCanWriteClinic(ctx: RequestContext, clinicId: number): Promise<TcmClinicStaff | null> {
        const administratorId = await this.administratorIdOf(ctx, ctx.activeUserId as number);
        if (administratorId === null) {
            throw new ClinicScopeForbiddenError('not-bound');
        }
        const repo = this.connection.getRepository(ctx, TcmClinicStaff);
        const staff = await repo.findOne({ where: { administratorId, clinicId } });
        if (staff) {
            return staff;
        }
        if (this.isSuperAdmin(ctx)) {
            return null;
        }
        // 完全没有任何员工绑定 → 「未绑定诊所」；有绑定但不含目标馆 → 「不属于该馆」
        const anyBinding = await repo.findOne({ where: { administratorId } });
        throw anyBinding
            ? new ClinicScopeForbiddenError('wrong-clinic', clinicId)
            : new ClinicScopeForbiddenError('not-bound');
    }

    async staffOf(ctx: RequestContext, userId: number): Promise<TcmClinicStaff[]> {
        const administratorId = await this.administratorIdOf(ctx, userId);
        if (administratorId === null) {
            return [];
        }
        return this.connection
            .getRepository(ctx, TcmClinicStaff)
            .find({ where: { administratorId } });
    }
}
