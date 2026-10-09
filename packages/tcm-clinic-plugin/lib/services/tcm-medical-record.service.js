"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcmMedicalRecordService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const constants_1 = require("../constants");
const tcm_crypto_service_1 = require("../crypto/tcm-crypto.service");
const tcm_encounter_entity_1 = require("../entities/tcm-encounter.entity");
const tcm_medical_record_entity_1 = require("../entities/tcm-medical-record.entity");
const tcm_medical_record_revision_entity_1 = require("../entities/tcm-medical-record-revision.entity");
const tcm_audit_service_1 = require("./tcm-audit.service");
let TcmMedicalRecordService = class TcmMedicalRecordService {
    constructor(connection, crypto, audit, options) {
        var _a;
        this.connection = connection;
        this.crypto = crypto;
        this.audit = audit;
        this.retentionYears = (_a = options.retentionYears) !== null && _a !== void 0 ? _a : 15;
    }
    async create(ctx, staffId, input) {
        var _a;
        const encounterRepo = this.connection.getRepository(ctx, tcm_encounter_entity_1.TcmEncounter);
        const encounter = await encounterRepo.findOne({ where: { id: input.encounterId } });
        if (!encounter) {
            throw new core_1.UserInputError(`接诊不存在：${input.encounterId}`);
        }
        const repo = this.connection.getRepository(ctx, tcm_medical_record_entity_1.TcmMedicalRecord);
        const retentionUntil = new Date(Date.now() + this.retentionYears * 365 * 24 * 3600 * 1000);
        const record = await repo.save(new tcm_medical_record_entity_1.TcmMedicalRecord({
            encounterId: Number(encounter.id),
            patientProfileId: encounter.patientProfileId,
            clinicId: encounter.clinicId,
            chiefComplaintEnc: this.crypto.encrypt(input.chiefComplaint),
            diagnosisEnc: this.crypto.encrypt(input.diagnosis),
            prescriptionEnc: this.crypto.encrypt(JSON.stringify((_a = input.prescription) !== null && _a !== void 0 ? _a : {})),
            version: 1,
            retentionUntil,
        }));
        await this.audit.log(ctx, {
            entityType: 'TcmMedicalRecord', entityId: Number(record.id), staffId, action: 'CREATE',
            diff: { version: 1 },
        });
        return record;
    }
    /** 更新：旧版本整体快照进 revision 表 + 审计，版本号 +1 */
    async update(ctx, staffId, id, input) {
        const repo = this.connection.getRepository(ctx, tcm_medical_record_entity_1.TcmMedicalRecord);
        const record = await repo.findOne({ where: { id } });
        if (!record) {
            throw new core_1.UserInputError(`病志不存在：${id}`);
        }
        if (new Date() > record.retentionUntil) {
            throw new core_1.IllegalOperationError('病志已过保存期限，归档只读');
        }
        const revRepo = this.connection.getRepository(ctx, tcm_medical_record_revision_entity_1.TcmMedicalRecordRevision);
        await revRepo.save(new tcm_medical_record_revision_entity_1.TcmMedicalRecordRevision({
            recordId: Number(record.id),
            version: record.version,
            chiefComplaintEnc: record.chiefComplaintEnc,
            diagnosisEnc: record.diagnosisEnc,
            prescriptionEnc: record.prescriptionEnc,
            editedByStaffId: staffId,
        }));
        const nextVersion = record.version + 1;
        const updated = await repo.save(Object.assign(Object.assign({}, record), { chiefComplaintEnc: input.chiefComplaint ? this.crypto.encrypt(input.chiefComplaint) : record.chiefComplaintEnc, diagnosisEnc: input.diagnosis ? this.crypto.encrypt(input.diagnosis) : record.diagnosisEnc, prescriptionEnc: input.prescription
                ? this.crypto.encrypt(JSON.stringify(input.prescription))
                : record.prescriptionEnc, version: nextVersion }));
        await this.audit.log(ctx, {
            entityType: 'TcmMedicalRecord', entityId: id, staffId, action: 'UPDATE',
            diff: { fromVersion: record.version, toVersion: nextVersion, fields: Object.keys(input) },
        });
        return updated;
    }
    /** 管理端解密视图（仅本馆员工可调用，由 resolver 守卫） */
    async decryptView(record) {
        return {
            chiefComplaint: this.crypto.decrypt(record.chiefComplaintEnc),
            diagnosis: this.crypto.decrypt(record.diagnosisEnc),
            prescription: JSON.parse(this.crypto.decrypt(record.prescriptionEnc)),
        };
    }
    /** 病志列表（含 revisions 解密视图） */
    async findAll(ctx, options = {}) {
        const repo = this.connection.getRepository(ctx, tcm_medical_record_entity_1.TcmMedicalRecord);
        const [records, totalItems] = await repo.findAndCount({
            skip: options.skip,
            take: options.take,
            order: { id: 'ASC' },
        });
        const revRepo = this.connection.getRepository(ctx, tcm_medical_record_revision_entity_1.TcmMedicalRecordRevision);
        const revisions = records.length
            ? await revRepo.find({
                where: { recordId: (0, typeorm_1.In)(records.map(r => r.id)) },
                order: { version: 'ASC' },
            })
            : [];
        const items = await Promise.all(records.map(async (record) => (Object.assign(Object.assign({ id: Number(record.id), encounterId: record.encounterId, clinicId: record.clinicId, version: record.version }, (await this.decryptView(record))), { revisions: revisions
                .filter(r => r.recordId === record.id)
                .map(r => ({ version: r.version, editedByStaffId: r.editedByStaffId, createdAt: r.createdAt })) }))));
        return { items, totalItems };
    }
    /** 单条病志视图（含版本链），供工作台详情页 */
    async findOneView(ctx, recordId) {
        const record = await this.connection.getRepository(ctx, tcm_medical_record_entity_1.TcmMedicalRecord).findOne({ where: { id: recordId } });
        if (!record)
            return null;
        const view = await this.decryptView(record);
        const revisions = await this.connection.getRepository(ctx, tcm_medical_record_revision_entity_1.TcmMedicalRecordRevision).find({
            where: { recordId },
            order: { version: 'ASC' },
        });
        return Object.assign(Object.assign({ id: Number(record.id), encounterId: record.encounterId, clinicId: record.clinicId, version: record.version }, view), { revisions: revisions.map(r => ({
                version: r.version,
                editedByStaffId: r.editedByStaffId,
                createdAt: r.createdAt,
            })) });
    }
};
exports.TcmMedicalRecordService = TcmMedicalRecordService;
exports.TcmMedicalRecordService = TcmMedicalRecordService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(constants_1.TCM_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        tcm_crypto_service_1.TcmCryptoService,
        tcm_audit_service_1.TcmAuditService, Object])
], TcmMedicalRecordService);
//# sourceMappingURL=tcm-medical-record.service.js.map