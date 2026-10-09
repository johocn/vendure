import { RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
export declare class TcmStaffService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 取当前管理员在指定馆的员工身份；非本馆员工抛 Forbidden */
    assertStaffOfClinic(ctx: RequestContext, clinicId: number): Promise<TcmClinicStaff>;
    staffOf(ctx: RequestContext, administratorId: number): Promise<TcmClinicStaff[]>;
}
