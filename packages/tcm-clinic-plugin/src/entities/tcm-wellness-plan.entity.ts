import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_wellness_plan' })
@Index(['patientProfileId', 'status'])
export class TcmWellnessPlan extends VendureEntity {
    constructor(input?: DeepPartial<TcmWellnessPlan>) {
        super(input);
    }
    @Column({ type: 'int' })
    patientProfileId: number;
    @Column({ type: 'int' })
    clinicId: number;
    @Column({ type: 'varchar', length: 255 })
    title: string;
    /** DRAFT | ACTIVE | PAUSED | CLOSED */
    @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
    status: string;
    @Column({ type: 'timestamp', nullable: true })
    cycleStart?: Date;
    @Column({ type: 'timestamp', nullable: true })
    cycleEnd?: Date;
}
