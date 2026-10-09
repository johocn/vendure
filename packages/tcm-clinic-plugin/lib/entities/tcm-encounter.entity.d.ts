import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmEncounter extends VendureEntity {
    constructor(input?: DeepPartial<TcmEncounter>);
    patientProfileId: number;
    clinicId: number;
    /** 接诊医生 staffId（tcm_clinic_staff.id） */
    staffId: number;
    /** initial | revisit | housecall */
    type: string;
    /** PENDING | ACTIVE | COMPLETED */
    status: string;
    version: number;
}
