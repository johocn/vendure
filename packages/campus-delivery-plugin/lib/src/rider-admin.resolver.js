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
exports.RiderAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const rider_service_1 = require("./rider.service");
const permissions_1 = require("./permissions");
const rider_wallet_service_1 = require("./rider-wallet.service");
let RiderAdminResolver = class RiderAdminResolver {
    constructor(riderService, wallet) {
        this.riderService = riderService;
        this.wallet = wallet;
    }
    async riderApplications(ctx, status) {
        return this.riderService.listApplications(ctx, status);
    }
    async campusSetRiderStatus(ctx, customerId, status) {
        return this.riderService.setRiderStatus(ctx, Number(customerId), status);
    }
    /** 骑手提现申请列表（status=ALL/PENDING/PAID/REJECTED，渠道隔离） */
    async riderWithdrawals(ctx, status, skip, take) {
        return this.wallet.adminList(ctx, status, skip, take);
    }
    /** 通过：标记 PAID 留痕（金额已在申请时冻结扣减） */
    async approveRiderWithdraw(ctx, id, remark) {
        return this.wallet.adminApprove(ctx, id, remark);
    }
    /** 驳回：状态 REJECTED 并退回冻结金额 */
    async rejectRiderWithdraw(ctx, id, remark) {
        return this.wallet.adminReject(ctx, id, remark);
    }
};
exports.RiderAdminResolver = RiderAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusAuditRider),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], RiderAdminResolver.prototype, "riderApplications", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusAuditRider),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('customerId')),
    __param(2, (0, graphql_1.Args)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], RiderAdminResolver.prototype, "campusSetRiderStatus", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusAuditRider),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('status', { nullable: true })),
    __param(2, (0, graphql_1.Args)('skip', { nullable: true })),
    __param(3, (0, graphql_1.Args)('take', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], RiderAdminResolver.prototype, "riderWithdrawals", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusAuditRider),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('remark', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], RiderAdminResolver.prototype, "approveRiderWithdraw", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusAuditRider),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('remark', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], RiderAdminResolver.prototype, "rejectRiderWithdraw", null);
exports.RiderAdminResolver = RiderAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [rider_service_1.RiderService,
        rider_wallet_service_1.RiderWalletService])
], RiderAdminResolver);
//# sourceMappingURL=rider-admin.resolver.js.map