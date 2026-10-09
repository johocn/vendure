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
exports.TcmClinicService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const tcm_clinic_entity_1 = require("../entities/tcm-clinic.entity");
const tcm_clinic_staff_entity_1 = require("../entities/tcm-clinic-staff.entity");
const tcm_patient_profile_entity_1 = require("../entities/tcm-patient-profile.entity");
let TcmClinicService = class TcmClinicService {
    constructor(connection, customerService) {
        this.connection = connection;
        this.customerService = customerService;
    }
    async createClinic(ctx, input) {
        const repo = this.connection.getRepository(ctx, tcm_clinic_entity_1.TcmClinic);
        const clinic = await repo.save(new tcm_clinic_entity_1.TcmClinic(Object.assign(Object.assign({}, input), { status: 'enabled' })));
        return clinic;
    }
    async findAll(ctx) {
        return this.connection.getRepository(ctx, tcm_clinic_entity_1.TcmClinic).find({ order: { id: 'ASC' } });
    }
    async findOne(ctx, id) {
        return this.connection.getRepository(ctx, tcm_clinic_entity_1.TcmClinic).findOne({ where: { id } });
    }
    async createClinicStaff(ctx, input) {
        var _a;
        return this.connection
            .getRepository(ctx, tcm_clinic_staff_entity_1.TcmClinicStaff)
            .save(new tcm_clinic_staff_entity_1.TcmClinicStaff(Object.assign(Object.assign({}, input), { role: (_a = input.role) !== null && _a !== void 0 ? _a : 'doctor' })));
    }
    async createPatientProfile(ctx, input) {
        const repo = this.connection.getRepository(ctx, tcm_patient_profile_entity_1.TcmPatientProfile);
        const existing = await repo.findOne({ where: { customerId: input.customerId } });
        if (existing) {
            return existing; // 跨馆共享一份档案
        }
        return repo.save(new tcm_patient_profile_entity_1.TcmPatientProfile(input));
    }
    async findPatientProfile(ctx, id) {
        return this.connection.getRepository(ctx, tcm_patient_profile_entity_1.TcmPatientProfile).findOne({ where: { id } });
    }
    /** 按 User id 找关联客户（Shop API 归属校验第一步） */
    async findCustomerByUserId(ctx, userId) {
        const customer = await this.customerService.findOneByUserId(ctx, userId);
        return customer !== null && customer !== void 0 ? customer : null;
    }
    /** 按 Customer id 找患者档案（Shop API 归属校验第二步） */
    async findProfileByCustomerId(ctx, customerId) {
        return this.connection.getRepository(ctx, tcm_patient_profile_entity_1.TcmPatientProfile).findOne({ where: { customerId } });
    }
};
exports.TcmClinicService = TcmClinicService;
exports.TcmClinicService = TcmClinicService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, core_1.CustomerService])
], TcmClinicService);
//# sourceMappingURL=tcm-clinic.service.js.map