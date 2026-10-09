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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcmMedicalRecord = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let TcmMedicalRecord = class TcmMedicalRecord extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.TcmMedicalRecord = TcmMedicalRecord;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], TcmMedicalRecord.prototype, "encounterId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], TcmMedicalRecord.prototype, "patientProfileId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], TcmMedicalRecord.prototype, "clinicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 4096 }),
    __metadata("design:type", String)
], TcmMedicalRecord.prototype, "chiefComplaintEnc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8192 }),
    __metadata("design:type", String)
], TcmMedicalRecord.prototype, "diagnosisEnc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8192 }),
    __metadata("design:type", String)
], TcmMedicalRecord.prototype, "prescriptionEnc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], TcmMedicalRecord.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 4096, nullable: true }),
    __metadata("design:type", String)
], TcmMedicalRecord.prototype, "signaturePayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", String)
], TcmMedicalRecord.prototype, "signatureCert", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], TcmMedicalRecord.prototype, "retentionUntil", void 0);
exports.TcmMedicalRecord = TcmMedicalRecord = __decorate([
    (0, typeorm_1.Entity)({ name: 'tcm_medical_record' }),
    (0, typeorm_1.Index)(['encounterId']),
    __metadata("design:paramtypes", [Object])
], TcmMedicalRecord);
//# sourceMappingURL=tcm-medical-record.entity.js.map