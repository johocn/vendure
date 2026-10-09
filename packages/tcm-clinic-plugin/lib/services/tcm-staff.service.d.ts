import { RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
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
    staffOf(ctx: RequestContext, userId: number): Promise<TcmClinicStaff[]>;
}
