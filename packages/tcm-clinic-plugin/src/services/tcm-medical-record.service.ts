import { Inject, Injectable } from '@nestjs/common';
import { IllegalOperationError, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { In } from 'typeorm';

import { TCM_PLUGIN_OPTIONS } from '../constants';
import { TcmCryptoService } from '../crypto/tcm-crypto.service';
import { TcmEncounter } from '../entities/tcm-encounter.entity';
import { TcmMedicalRecord } from '../entities/tcm-medical-record.entity';
import { TcmMedicalRecordRevision } from '../entities/tcm-medical-record-revision.entity';
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

@Injectable()
export class TcmMedicalRecordService {
    private readonly retentionYears: number;

    constructor(
        private connection: TransactionalConnection,
        private crypto: TcmCryptoService,
        private audit: TcmAuditService,
        @Inject(TCM_PLUGIN_OPTIONS) options: TcmClinicPluginOptions,
    ) {
        this.retentionYears = options.retentionYears ?? 15;
    }

    async create(ctx: RequestContext, staffId: number, input: MedicalRecordInput): Promise<TcmMedicalRecord> {
        const encounterRepo = this.connection.getRepository(ctx, TcmEncounter);
        const encounter = await encounterRepo.findOne({ where: { id: input.encounterId } });
        if (!encounter) {
            throw new UserInputError(`接诊不存在：${input.encounterId}`);
        }
        const repo = this.connection.getRepository(ctx, TcmMedicalRecord);
        const retentionUntil = new Date(Date.now() + this.retentionYears * 365 * 24 * 3600 * 1000);
        const record = await repo.save(
            new TcmMedicalRecord({
                encounterId: encounter.id,
                patientProfileId: encounter.patientProfileId,
                clinicId: encounter.clinicId,
                chiefComplaintEnc: this.crypto.encrypt(input.chiefComplaint),
                diagnosisEnc: this.crypto.encrypt(input.diagnosis),
                prescriptionEnc: this.crypto.encrypt(JSON.stringify(input.prescription ?? {})),
                version: 1,
                retentionUntil,
            }),
        );
        await this.audit.log(ctx, {
            entityType: 'TcmMedicalRecord', entityId: record.id, staffId, action: 'CREATE',
            diff: { version: 1 },
        });
        return record;
    }

    /** 更新：旧版本整体快照进 revision 表 + 审计，版本号 +1 */
    async update(
        ctx: RequestContext,
        staffId: number,
        id: number,
        input: Partial<MedicalRecordInput>,
    ): Promise<TcmMedicalRecord> {
        const repo = this.connection.getRepository(ctx, TcmMedicalRecord);
        const record = await repo.findOne({ where: { id } });
        if (!record) {
            throw new UserInputError(`病志不存在：${id}`);
        }
        if (new Date() > record.retentionUntil) {
            throw new IllegalOperationError('病志已过保存期限，归档只读');
        }
        const revRepo = this.connection.getRepository(ctx, TcmMedicalRecordRevision);
        await revRepo.save(
            new TcmMedicalRecordRevision({
                recordId: record.id,
                version: record.version,
                chiefComplaintEnc: record.chiefComplaintEnc,
                diagnosisEnc: record.diagnosisEnc,
                prescriptionEnc: record.prescriptionEnc,
                editedByStaffId: staffId,
            }),
        );
        const nextVersion = record.version + 1;
        const updated = await repo.save({
            ...record,
            chiefComplaintEnc: input.chiefComplaint ? this.crypto.encrypt(input.chiefComplaint) : record.chiefComplaintEnc,
            diagnosisEnc: input.diagnosis ? this.crypto.encrypt(input.diagnosis) : record.diagnosisEnc,
            prescriptionEnc: input.prescription
                ? this.crypto.encrypt(JSON.stringify(input.prescription))
                : record.prescriptionEnc,
            version: nextVersion,
        });
        await this.audit.log(ctx, {
            entityType: 'TcmMedicalRecord', entityId: id, staffId, action: 'UPDATE',
            diff: { fromVersion: record.version, toVersion: nextVersion, fields: Object.keys(input) },
        });
        return updated;
    }

    /** 管理端解密视图（仅本馆员工可调用，由 resolver 守卫） */
    async decryptView(record: TcmMedicalRecord): Promise<{
        chiefComplaint: string; diagnosis: string; prescription: Record<string, any>;
    }> {
        return {
            chiefComplaint: this.crypto.decrypt(record.chiefComplaintEnc),
            diagnosis: this.crypto.decrypt(record.diagnosisEnc),
            prescription: JSON.parse(this.crypto.decrypt(record.prescriptionEnc)),
        };
    }

    /** 病志列表（含 revisions 解密视图） */
    async findAll(
        ctx: RequestContext,
        options: ListOptions = {},
    ): Promise<{ items: MedicalRecordView[]; totalItems: number }> {
        const repo = this.connection.getRepository(ctx, TcmMedicalRecord);
        const [records, totalItems] = await repo.findAndCount({
            skip: options.skip,
            take: options.take,
            order: { id: 'ASC' },
        });
        const revRepo = this.connection.getRepository(ctx, TcmMedicalRecordRevision);
        const revisions = records.length
            ? await revRepo.find({
                  where: { recordId: In(records.map(r => r.id)) },
                  order: { version: 'ASC' },
              })
            : [];
        const items = await Promise.all(
            records.map(async record => ({
                id: record.id,
                encounterId: record.encounterId,
                version: record.version,
                ...(await this.decryptView(record)),
                revisions: revisions
                    .filter(r => r.recordId === record.id)
                    .map(r => ({ version: r.version, editedByStaffId: r.editedByStaffId, createdAt: r.createdAt })),
            })),
        );
        return { items, totalItems };
    }
}
