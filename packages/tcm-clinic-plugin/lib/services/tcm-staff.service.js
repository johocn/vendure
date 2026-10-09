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
exports.TcmStaffService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const tcm_clinic_staff_entity_1 = require("../entities/tcm-clinic-staff.entity");
let TcmStaffService = class TcmStaffService {
    constructor(connection) {
        this.connection = connection;
    }
    /**
     * ctx.activeUserId 是 user id，而 tcm_clinic_staff.administratorId 存的是 administrator id，
     * 两者只有在极小库中才恰好相等（fixture 未暴露此 bug），必须先经 administrator 表映射。
     */
    async administratorIdOf(ctx, userId) {
        const admin = await this.connection
            .getRepository(ctx, core_1.Administrator)
            .findOne({ where: { user: { id: userId } } });
        return admin ? admin.id : null;
    }
    /** 取当前管理员在指定馆的员工身份；非本馆员工抛 Forbidden */
    async assertStaffOfClinic(ctx, clinicId) {
        const administratorId = await this.administratorIdOf(ctx, ctx.activeUserId);
        if (administratorId === null) {
            throw new core_1.ForbiddenError();
        }
        const staff = await this.connection
            .getRepository(ctx, tcm_clinic_staff_entity_1.TcmClinicStaff)
            .findOne({ where: { administratorId, clinicId } });
        if (!staff) {
            // ForbiddenError 基于 i18n 固定文案，不支持自定义消息
            throw new core_1.ForbiddenError();
        }
        return staff;
    }
    async staffOf(ctx, userId) {
        const administratorId = await this.administratorIdOf(ctx, userId);
        if (administratorId === null) {
            return [];
        }
        return this.connection
            .getRepository(ctx, tcm_clinic_staff_entity_1.TcmClinicStaff)
            .find({ where: { administratorId } });
    }
};
exports.TcmStaffService = TcmStaffService;
exports.TcmStaffService = TcmStaffService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], TcmStaffService);
//# sourceMappingURL=tcm-staff.service.js.map