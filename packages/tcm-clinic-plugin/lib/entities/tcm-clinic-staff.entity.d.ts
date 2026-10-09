import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmClinicStaff extends VendureEntity {
    constructor(input?: DeepPartial<TcmClinicStaff>);
    /** 关联 Administrator.id，不建外键 */
    administratorId: number;
    clinicId: number;
    /** doctor | therapist | admin */
    role: string;
    displayName: string;
}
