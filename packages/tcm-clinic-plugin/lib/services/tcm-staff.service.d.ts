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
    /** 当前请求是否超级管理员（SuperAdmin 权限保留跨馆全量读取） */
    isSuperAdmin(ctx: RequestContext): boolean;
    /** 只读路径的馆归属校验：SuperAdmin 放行，其余必须是该馆员工（否则 Forbidden） */
    assertCanReadClinic(ctx: RequestContext, clinicId: number): Promise<void>;
    staffOf(ctx: RequestContext, userId: number): Promise<TcmClinicStaff[]>;
}
