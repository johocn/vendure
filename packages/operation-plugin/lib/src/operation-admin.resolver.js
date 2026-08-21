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
exports.OperationAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const operation_service_1 = require("./operation.service");
let OperationAdminResolver = class OperationAdminResolver {
    constructor(operationService) {
        this.operationService = operationService;
    }
    async operationSections(ctx) {
        return this.operationService.listSections(ctx);
    }
    async operationSection(ctx, code) {
        return this.operationService.getByCode(ctx, code);
    }
    async createOperationSection(ctx, input) {
        return this.operationService.createSection(ctx, input);
    }
    async updateOperationSection(ctx, id, input) {
        return this.operationService.updateSection(ctx, id, input);
    }
    async deleteOperationSection(ctx, id) {
        return this.operationService.deleteSection(ctx, id);
    }
    async setOperationItems(ctx, sectionId, items) {
        return this.operationService.setOperationItems(ctx, sectionId, items);
    }
};
exports.OperationAdminResolver = OperationAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], OperationAdminResolver.prototype, "operationSections", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], OperationAdminResolver.prototype, "operationSection", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], OperationAdminResolver.prototype, "createOperationSection", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], OperationAdminResolver.prototype, "updateOperationSection", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], OperationAdminResolver.prototype, "deleteOperationSection", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('sectionId')),
    __param(2, (0, graphql_1.Args)('items')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], OperationAdminResolver.prototype, "setOperationItems", null);
exports.OperationAdminResolver = OperationAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [operation_service_1.OperationService])
], OperationAdminResolver);
//# sourceMappingURL=operation-admin.resolver.js.map