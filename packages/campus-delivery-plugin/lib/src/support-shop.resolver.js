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
exports.SupportShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const rider_ops_service_1 = require("./rider-ops.service");
const support_service_1 = require("./support.service");
/** C 端：客服工单 / 骑手申诉 / 骑手评分 / 我的班次 / 配送导航 */
let SupportShopResolver = class SupportShopResolver {
    constructor(support, riderOps) {
        this.support = support;
        this.riderOps = riderOps;
    }
    async campusMySupportTickets(ctx, skip, take) {
        return this.support.myTickets(ctx, skip, take);
    }
    async campusCreateSupportTicket(ctx, category, content, images, orderCode) {
        return this.support.createTicket(ctx, { category, content, images, orderCode });
    }
    async campusMyRiderAppeals(ctx, skip, take) {
        return this.support.myAppeals(ctx, skip, take);
    }
    async campusCreateRiderAppeal(ctx, reason, orderId, images) {
        return this.support.createAppeal(ctx, { orderId, reason, images });
    }
    async campusMyRiderRating(ctx) {
        return this.riderOps.ratingStats(ctx);
    }
    /** 骑手自己的评价明细（P3-3）：均分之外的逐条评分/标签/留言 */
    async campusMyRiderReviews(ctx, skip, take) {
        return this.riderOps.myReviews(ctx, skip, take);
    }
    async campusRateRider(ctx, orderId, rating, tags, comment) {
        const row = await this.riderOps.createReview(ctx, orderId, rating, tags, comment);
        return { ok: true, rating: row.rating };
    }
    async campusMyShifts(ctx, from, to) {
        return this.riderOps.myShifts(ctx, from, to);
    }
    async campusRiderNav(ctx, orderId) {
        return this.riderOps.riderNav(ctx, orderId);
    }
};
exports.SupportShopResolver = SupportShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], SupportShopResolver.prototype, "campusMySupportTickets", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('category')),
    __param(2, (0, graphql_1.Args)('content')),
    __param(3, (0, graphql_1.Args)({ name: 'images', type: () => [String], nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'orderCode', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, Array, String]),
    __metadata("design:returntype", Promise)
], SupportShopResolver.prototype, "campusCreateSupportTicket", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], SupportShopResolver.prototype, "campusMyRiderAppeals", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('reason')),
    __param(2, (0, graphql_1.Args)({ name: 'orderId', type: () => graphql_1.ID, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'images', type: () => [String], nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object, Array]),
    __metadata("design:returntype", Promise)
], SupportShopResolver.prototype, "campusCreateRiderAppeal", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], SupportShopResolver.prototype, "campusMyRiderRating", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], SupportShopResolver.prototype, "campusMyRiderReviews", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('rating')),
    __param(3, (0, graphql_1.Args)({ name: 'tags', type: () => [String], nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'comment', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, Array, String]),
    __metadata("design:returntype", Promise)
], SupportShopResolver.prototype, "campusRateRider", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'from', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'to', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], SupportShopResolver.prototype, "campusMyShifts", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SupportShopResolver.prototype, "campusRiderNav", null);
exports.SupportShopResolver = SupportShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [support_service_1.SupportService, rider_ops_service_1.RiderOpsService])
], SupportShopResolver);
//# sourceMappingURL=support-shop.resolver.js.map