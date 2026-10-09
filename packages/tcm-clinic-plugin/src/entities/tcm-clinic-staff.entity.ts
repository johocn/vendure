import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_clinic_staff' })
@Index(['administratorId', 'clinicId'], { unique: true })
export class TcmClinicStaff extends VendureEntity {
    constructor(input?: DeepPartial<TcmClinicStaff>) {
        super(input);
    }
    /** 关联 Administrator.id，不建外键 */
    @Column({ type: 'int' })
    administratorId: number;
    @Column({ type: 'int' })
    clinicId: number;
    /** doctor | therapist | admin */
    @Column({ type: 'varchar', length: 16, default: 'doctor' })
    role: string;
    @Column({ type: 'varchar', length: 64 })
    displayName: string;
}
