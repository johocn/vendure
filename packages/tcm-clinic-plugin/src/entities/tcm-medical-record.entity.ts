import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_medical_record' })
@Index(['encounterId'])
export class TcmMedicalRecord extends VendureEntity {
    constructor(input?: DeepPartial<TcmMedicalRecord>) {
        super(input);
    }
    @Column({ type: 'int' })
    encounterId: number;
    @Column({ type: 'int' })
    patientProfileId: number;
    @Column({ type: 'int' })
    clinicId: number;
    /** 加密：主诉 */
    @Column({ type: 'varchar', length: 4096 })
    chiefComplaintEnc: string;
    /** 加密：现病史/诊断 */
    @Column({ type: 'varchar', length: 8192 })
    diagnosisEnc: string;
    /** 处方（结构化 JSON，整体加密存储） */
    @Column({ type: 'varchar', length: 8192 })
    prescriptionEnc: string;
    @Column({ type: 'int', default: 1 })
    version: number;
    /** 预留：电子签名负载（JSON 字符串，接 CA 时启用） */
    @Column({ type: 'varchar', length: 4096, nullable: true })
    signaturePayload?: string;
    /** 预留：签名证书序列号 */
    @Column({ type: 'varchar', length: 128, nullable: true })
    signatureCert?: string;
    /** 保存期限：到期后归档只读（门诊病志 ≥15 年） */
    @Column({ type: 'timestamp' })
    retentionUntil: Date;
}
