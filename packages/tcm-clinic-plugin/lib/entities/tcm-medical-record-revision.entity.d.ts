import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmMedicalRecordRevision extends VendureEntity {
    constructor(input?: DeepPartial<TcmMedicalRecordRevision>);
    recordId: number;
    /** 快照对应的版本号 */
    version: number;
    chiefComplaintEnc: string;
    diagnosisEnc: string;
    prescriptionEnc: string;
    /** 被谁改 */
    editedByStaffId: number;
}
