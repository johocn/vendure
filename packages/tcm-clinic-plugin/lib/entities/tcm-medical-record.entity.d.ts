import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmMedicalRecord extends VendureEntity {
    constructor(input?: DeepPartial<TcmMedicalRecord>);
    encounterId: number;
    patientProfileId: number;
    clinicId: number;
    /** 加密：主诉 */
    chiefComplaintEnc: string;
    /** 加密：现病史/诊断 */
    diagnosisEnc: string;
    /** 处方（结构化 JSON，整体加密存储） */
    prescriptionEnc: string;
    version: number;
    /** 预留：电子签名负载（JSON 字符串，接 CA 时启用） */
    signaturePayload?: string;
    /** 预留：签名证书序列号 */
    signatureCert?: string;
    /** 保存期限：到期后归档只读（门诊病志 ≥15 年） */
    retentionUntil: Date;
}
