import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_medical_record_revisions' })
@Index(['recordId', 'version'], { unique: true })
export class TcmMedicalRecordRevision extends VendureEntity {
    constructor(input?: DeepPartial<TcmMedicalRecordRevision>) {
        super(input);
    }
    @Column({ type: 'int' })
    recordId: number;
    /** 快照对应的版本号 */
    @Column({ type: 'int' })
    version: number;
    @Column({ type: 'varchar', length: 8192 })
    chiefComplaintEnc: string;
    @Column({ type: 'varchar', length: 8192 })
    diagnosisEnc: string;
    @Column({ type: 'varchar', length: 8192 })
    prescriptionEnc: string;
    /** 被谁改 */
    @Column({ type: 'int' })
    editedByStaffId: number;
}
