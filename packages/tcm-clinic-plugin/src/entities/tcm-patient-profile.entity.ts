import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_patient_profile' })
@Index(['customerId'], { unique: true })
export class TcmPatientProfile extends VendureEntity {
    constructor(input?: DeepPartial<TcmPatientProfile>) {
        super(input);
    }
    /** 引用 Customer.id，不建外键；一名患者（SSO 用户）一份档案 */
    @Column({ type: 'int' })
    customerId: number;
    /** 建档案馆 */
    @Column({ type: 'int' })
    clinicId: number;
    /** 体质辨识等结构化结果 */
    @Column({ type: 'simple-json', nullable: true })
    constitution?: Record<string, any>;
}
