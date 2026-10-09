import { Injectable } from '@nestjs/common';
import { ForbiddenError, RequestContext, TransactionalConnection } from '@vendure/core';

import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';

@Injectable()
export class TcmStaffService {
    constructor(private connection: TransactionalConnection) {}

    /** 取当前管理员在指定馆的员工身份；非本馆员工抛 Forbidden */
    async assertStaffOfClinic(ctx: RequestContext, clinicId: number): Promise<TcmClinicStaff> {
        const staff = await this.connection
            .getRepository(ctx, TcmClinicStaff)
            .findOne({ where: { administratorId: ctx.activeUserId as number, clinicId } });
        if (!staff) {
            // ForbiddenError 基于 i18n 固定文案，不支持自定义消息
            throw new ForbiddenError();
        }
        return staff;
    }

    async staffOf(ctx: RequestContext, administratorId: number): Promise<TcmClinicStaff[]> {
        return this.connection
            .getRepository(ctx, TcmClinicStaff)
            .find({ where: { administratorId } });
    }
}
