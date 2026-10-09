import { RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmCryptoService } from '../crypto/tcm-crypto.service';
import { TcmMedicalRecord } from '../entities/tcm-medical-record.entity';
import { TcmClinicPluginOptions } from '../types';
import { TcmAuditService } from './tcm-audit.service';
export interface MedicalRecordInput {
    encounterId: number;
    chiefComplaint: string;
    diagnosis: string;
    prescription?: Record<string, any>;
}
export interface MedicalRecordRevisionView {
    version: number;
    editedByStaffId: number;
    createdAt: Date;
}
export interface MedicalRecordView {
    id: number;
    encounterId: number;
    clinicId: number;
    version: number;
    chiefComplaint: string;
    diagnosis: string;
    prescription: Record<string, any>;
    revisions: MedicalRecordRevisionView[];
}
export interface ListOptions {
    skip?: number;
    take?: number;
}
export declare class TcmMedicalRecordService {
    private connection;
    private crypto;
    private audit;
    private readonly retentionYears;
    constructor(connection: TransactionalConnection, crypto: TcmCryptoService, audit: TcmAuditService, options: TcmClinicPluginOptions);
    create(ctx: RequestContext, staffId: number, input: MedicalRecordInput): Promise<TcmMedicalRecord>;
    /** 更新：旧版本整体快照进 revision 表 + 审计，版本号 +1 */
    update(ctx: RequestContext, staffId: number, id: number, input: Partial<MedicalRecordInput>): Promise<TcmMedicalRecord>;
    /** 管理端解密视图（仅本馆员工可调用，由 resolver 守卫） */
    decryptView(record: TcmMedicalRecord): Promise<{
        chiefComplaint: string;
        diagnosis: string;
        prescription: Record<string, any>;
    }>;
    /** 病志列表（含 revisions 解密视图） */
    findAll(ctx: RequestContext, options?: ListOptions): Promise<{
        items: MedicalRecordView[];
        totalItems: number;
    }>;
    /** 单条病志视图（含版本链），供工作台详情页 */
    findOneView(ctx: RequestContext, recordId: number): Promise<MedicalRecordView | null>;
}
