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
exports.StudentAdminResolver = exports.StudentShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const student_service_1 = require("./student.service");
/**
 * 学生认证（人工审核流）resolver：
 * - shop-api：myStudentVerification / applyStudentVerification（登录用户）
 * - admin-api：studentVerifications / reviewStudentVerification（需 UpdateCustomer 权限）
 */
let StudentShopResolver = class StudentShopResolver {
    constructor(studentService) {
        this.studentService = studentService;
    }
    async myStudentVerification(ctx) {
        return this.studentService.myStatus(ctx);
    }
    async applyStudentVerification(ctx, school, studentNo, idImg) {
        return this.studentService.apply(ctx, { school, studentNo, idImg: idImg !== null && idImg !== void 0 ? idImg : null });
    }
};
exports.StudentShopResolver = StudentShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], StudentShopResolver.prototype, "myStudentVerification", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('school')),
    __param(2, (0, graphql_1.Args)('studentNo')),
    __param(3, (0, graphql_1.Args)('idImg', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, String]),
    __metadata("design:returntype", Promise)
], StudentShopResolver.prototype, "applyStudentVerification", null);
exports.StudentShopResolver = StudentShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [student_service_1.StudentVerificationService])
], StudentShopResolver);
let StudentAdminResolver = class StudentAdminResolver {
    constructor(studentService) {
        this.studentService = studentService;
    }
    async studentVerifications(ctx, status) {
        return this.studentService.list(ctx, status !== null && status !== void 0 ? status : undefined);
    }
    async reviewStudentVerification(ctx, customerId, approve) {
        return this.studentService.review(ctx, Number(customerId), approve);
    }
};
exports.StudentAdminResolver = StudentAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('status', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], StudentAdminResolver.prototype, "studentVerifications", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('customerId')),
    __param(2, (0, graphql_1.Args)('approve')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Boolean]),
    __metadata("design:returntype", Promise)
], StudentAdminResolver.prototype, "reviewStudentVerification", null);
exports.StudentAdminResolver = StudentAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [student_service_1.StudentVerificationService])
], StudentAdminResolver);
//# sourceMappingURL=student.resolvers.js.map