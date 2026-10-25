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
exports.SupportAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const permissions_1 = require("./permissions");
const rider_ops_service_1 = require("./rider-ops.service");
const support_service_1 = require("./support.service");
/** 运营侧：客服工单 / 骑手申诉 / 黑名单 / 排班 / 在线时长 / 评分查询 */
let SupportAdminResolver = class SupportAdminResolver {
    constructor(support, riderOps) {
        this.support = support;
        this.riderOps = riderOps;
    }
    async campusSupportTickets(ctx, status, skip, take) {
        return this.support.adminTickets(ctx, status, skip, take);
    }
    async campusReplySupportTicket(ctx, id, reply, status) {
        return this.support.replyTicket(ctx, id, reply, status);
    }
    async campusRiderAppeals(ctx, status, skip, take) {
        return this.support.adminAppeals(ctx, status, skip, take);
    }
    async campusReviewRiderAppeal(ctx, id, approve, creditDelta, note) {
        return this.support.reviewAppeal(ctx, id, approve, creditDelta, note);
    }
    async campusBlacklist(ctx, skip, take) {
        return this.support.listBlacklist(ctx, skip, take);
    }
    async campusAddBlacklist(ctx, type, value, reason) {
        return this.support.addBlacklist(ctx, { type, value, reason });
    }
    async campusRemoveBlacklist(ctx, id) {
        return this.support.removeBlacklist(ctx, id);
    }
    async campusRiderShifts(ctx, date) {
        return this.riderOps.listShifts(ctx, date);
    }
    async campusSaveRiderShift(ctx, input) {
        return this.riderOps.saveShift(ctx, input);
    }
    async campusDeleteRiderShift(ctx, id) {
        return this.riderOps.deleteShift(ctx, id);
    }
    async campusRiderOnlineStats(ctx, date) {
        return this.riderOps.onlineStats(ctx, date);
    }
    async campusRiderReviews(ctx, riderCustomerId, skip, take) {
        return this.riderOps.adminReviews(ctx, riderCustomerId, skip, take);
    }
    async campusRiderRating(ctx, riderCustomerId) {
        return this.riderOps.ratingStats(ctx, riderCustomerId);
    }
};
exports.SupportAdminResolver = SupportAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusSupportTickets", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)({ name: 'reply', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusReplySupportTicket", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusRiderAppeals", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('approve')),
    __param(3, (0, graphql_1.Args)({ name: 'creditDelta', type: () => Number, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'note', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Boolean, Number, String]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusReviewRiderAppeal", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusBlacklist", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('type')),
    __param(2, (0, graphql_1.Args)('value')),
    __param(3, (0, graphql_1.Args)({ name: 'reason', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, String]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusAddBlacklist", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusRemoveBlacklist", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusRiderShifts", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusSaveRiderShift", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusDeleteRiderShift", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'date', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusRiderOnlineStats", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'riderCustomerId', type: () => graphql_1.ID, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusRiderReviews", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('riderCustomerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SupportAdminResolver.prototype, "campusRiderRating", null);
exports.SupportAdminResolver = SupportAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [support_service_1.SupportService, rider_ops_service_1.RiderOpsService])
], SupportAdminResolver);
//# sourceMappingURL=support-admin.resolver.js.map