import { Column, Entity, Index, VersionColumn } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_encounter' })
@Index(['patientProfileId', 'status'])
export class TcmEncounter extends VendureEntity {
    constructor(input?: DeepPartial<TcmEncounter>) {
        super(input);
    }
    @Column({ type: 'int' })
    patientProfileId: number;
    @Column({ type: 'int' })
    clinicId: number;
    /** 接诊医生 staffId（tcm_clinic_staff.id） */
    @Column({ type: 'int' })
    staffId: number;
    /** initial | revisit | housecall */
    @Column({ type: 'varchar', length: 16, default: 'initial' })
    type: string;
    /** PENDING | ACTIVE | COMPLETED */
    @Column({ type: 'varchar', length: 16, default: 'PENDING' })
    status: string;
    @VersionColumn()
    version: number;
}
