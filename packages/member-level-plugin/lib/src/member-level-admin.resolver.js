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
exports.MemberLevelAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const permissions_1 = require("./permissions");
const member_level_service_1 = require("./member-level.service");
let MemberLevelAdminResolver = class MemberLevelAdminResolver {
    constructor(memberLevelService) {
        this.memberLevelService = memberLevelService;
    }
    async memberInfo(ctx, customerId) {
        return this.memberLevelService.getMemberInfo(ctx, customerId);
    }
    async pointsHistory(ctx, customerId, options) {
        return this.memberLevelService.getPointsHistory(ctx, customerId, options);
    }
    async members(ctx, options) {
        return this.memberLevelService.findAllMembers(ctx, options);
    }
    async levelConfig(ctx) {
        return this.memberLevelService.getLevelConfig(ctx);
    }
    async adjustPoints(ctx, customerId, amount, remark) {
        await this.memberLevelService.adjustPoints(ctx, customerId, amount, remark);
        return this.memberLevelService.getMemberInfo(ctx, customerId);
    }
    async adjustMemberGrowth(ctx, customerId, amount, source) {
        await this.memberLevelService.addGrowthValue(ctx, customerId, amount, source);
        return this.memberLevelService.getMemberInfo(ctx, customerId);
    }
    async updateLevelConfig(ctx, input) {
        return this.memberLevelService.updateLevelConfig(ctx, input);
    }
    async memberTiers(ctx) {
        return this.memberLevelService.listMemberTiers(ctx);
    }
    async saveTiers(ctx, input) {
        return this.memberLevelService.saveMemberTiers(ctx, input);
    }
};
exports.MemberLevelAdminResolver = MemberLevelAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.memberLevelPermission.Read),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MemberLevelAdminResolver.prototype, "memberInfo", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.memberLevelPermission.Read),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('customerId')),
    __param(2, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], MemberLevelAdminResolver.prototype, "pointsHistory", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.memberLevelPermission.Read),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MemberLevelAdminResolver.prototype, "members", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.memberLevelPermission.Read),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], MemberLevelAdminResolver.prototype, "levelConfig", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.memberLevelPermission.Update),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('customerId')),
    __param(2, (0, graphql_1.Args)('amount')),
    __param(3, (0, graphql_1.Args)('remark', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, String]),
    __metadata("design:returntype", Promise)
], MemberLevelAdminResolver.prototype, "adjustPoints", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.memberLevelPermission.Update),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('customerId')),
    __param(2, (0, graphql_1.Args)('amount')),
    __param(3, (0, graphql_1.Args)('source', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, String]),
    __metadata("design:returntype", Promise)
], MemberLevelAdminResolver.prototype, "adjustMemberGrowth", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.memberLevelPermission.Update),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MemberLevelAdminResolver.prototype, "updateLevelConfig", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.memberLevelPermission.Read),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], MemberLevelAdminResolver.prototype, "memberTiers", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.memberLevelPermission.Update),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input', { type: () => [Object] })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], MemberLevelAdminResolver.prototype, "saveTiers", null);
exports.MemberLevelAdminResolver = MemberLevelAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [member_level_service_1.MemberLevelService])
], MemberLevelAdminResolver);
//# sourceMappingURL=member-level-admin.resolver.js.map