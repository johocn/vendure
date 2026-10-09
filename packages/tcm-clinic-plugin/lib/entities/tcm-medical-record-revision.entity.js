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
exports.TcmMedicalRecordRevision = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let TcmMedicalRecordRevision = class TcmMedicalRecordRevision extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.TcmMedicalRecordRevision = TcmMedicalRecordRevision;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], TcmMedicalRecordRevision.prototype, "recordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], TcmMedicalRecordRevision.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8192 }),
    __metadata("design:type", String)
], TcmMedicalRecordRevision.prototype, "chiefComplaintEnc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8192 }),
    __metadata("design:type", String)
], TcmMedicalRecordRevision.prototype, "diagnosisEnc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8192 }),
    __metadata("design:type", String)
], TcmMedicalRecordRevision.prototype, "prescriptionEnc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], TcmMedicalRecordRevision.prototype, "editedByStaffId", void 0);
exports.TcmMedicalRecordRevision = TcmMedicalRecordRevision = __decorate([
    (0, typeorm_1.Entity)({ name: 'tcm_medical_record_revisions' }),
    (0, typeorm_1.Index)(['recordId', 'version'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], TcmMedicalRecordRevision);
//# sourceMappingURL=tcm-medical-record-revision.entity.js.map