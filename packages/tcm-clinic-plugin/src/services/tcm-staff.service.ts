import { Injectable } from '@nestjs/common';
import { Administrator, ForbiddenError, RequestContext, TransactionalConnection } from '@vendure/core';

import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';

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
