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
exports.StudentVerificationService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
function parseInfo(raw) {
    if (!raw)
        return {};
    try {
        const obj = JSON.parse(raw);
        return typeof obj === 'object' && obj ? obj : {};
    }
    catch (_a) {
        return {};
    }
}
let StudentVerificationService = class StudentVerificationService {
    constructor(connection) {
        this.connection = connection;
    }
    customerRepo(ctx) {
        return this.connection.getRepository(ctx, core_1.Customer);
    }
    statusOf(customer) {
        var _a;
        return ((_a = customer.customFields) === null || _a === void 0 ? void 0 : _a.studentStatus) || 'none';
    }
    toItem(customer) {
        var _a, _b, _c, _d, _e, _f;
        const info = parseInfo((_a = customer.customFields) === null || _a === void 0 ? void 0 : _a.studentInfo);
        return {
            customerId: String(customer.id),
            customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.emailAddress,
            customerEmail: customer.emailAddress,
            status: this.statusOf(customer),
            school: (_b = info.school) !== null && _b !== void 0 ? _b : null,
            studentNo: (_c = info.studentNo) !== null && _c !== void 0 ? _c : null,
            idImg: (_d = info.idImg) !== null && _d !== void 0 ? _d : null,
            reviewedAt: (_f = (_e = customer.customFields) === null || _e === void 0 ? void 0 : _e.studentReviewedAt) !== null && _f !== void 0 ? _f : null,
        };
    }
    /** C 端：提交/更新认证申请（approved 后不可重复提交，驳回后可重新提交） */
    async apply(ctx, input) {
        var _a, _b, _c;
        const school = ((_a = input.school) !== null && _a !== void 0 ? _a : '').trim().slice(0, 60);
        const studentNo = ((_b = input.studentNo) !== null && _b !== void 0 ? _b : '').trim().slice(0, 40);
        if (!school || !studentNo) {
            throw new core_1.UserInputError('school and studentNo are required');
        }
        const repo = this.customerRepo(ctx);
        const customer = await repo.findOne({ where: { id: ctx.activeUserId } });
        if (!customer) {
            throw new core_1.UserInputError('Customer not found');
        }
        if (this.statusOf(customer) === 'approved') {
            throw new core_1.UserInputError('Student verification already approved');
        }
        customer.customFields = Object.assign(Object.assign({}, customer.customFields), { studentStatus: 'pending', studentInfo: JSON.stringify({ school, studentNo, idImg: (_c = input.idImg) !== null && _c !== void 0 ? _c : null }) });
        await repo.save(customer);
        return this.toItem(customer);
    }
    /** C 端：查本人认证状态 */
    async myStatus(ctx) {
        const customer = await this.customerRepo(ctx).findOne({ where: { id: ctx.activeUserId } });
        if (!customer) {
            throw new core_1.UserInputError('Customer not found');
        }
        return this.toItem(customer);
    }
    /** 后台：按状态筛选认证列表（缺省返回全部已提交过申请的客户） */
    async list(ctx, status) {
        const statuses = status ? [status] : ['pending', 'approved', 'rejected'];
        // customFields 落在 customer 表真实列（studentStatus），直接按列查询
        const customers = await this.customerRepo(ctx)
            .createQueryBuilder('c')
            .where('c.studentStatus IN (:...statuses)', { statuses })
            .orderBy('c.id', 'DESC')
            .take(200)
            .getMany();
        return customers.map(c => this.toItem(c));
    }
    /** 后台：审核（approve=true → approved；false → rejected）；驳回后客户可重新提交 */
    async review(ctx, customerId, approve) {
        const repo = this.customerRepo(ctx);
        const customer = await repo.findOne({ where: { id: customerId } });
        if (!customer) {
            throw new core_1.UserInputError('Customer not found');
        }
        if (this.statusOf(customer) === 'none') {
            throw new core_1.UserInputError('Customer has no student verification application');
        }
        customer.customFields = Object.assign(Object.assign({}, customer.customFields), { studentStatus: approve ? 'approved' : 'rejected', studentReviewedAt: new Date() });
        await repo.save(customer);
        return this.toItem(customer);
    }
};
exports.StudentVerificationService = StudentVerificationService;
exports.StudentVerificationService = StudentVerificationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], StudentVerificationService);
//# sourceMappingURL=student.service.js.map