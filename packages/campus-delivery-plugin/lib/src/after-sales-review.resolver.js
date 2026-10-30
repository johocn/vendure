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
exports.AfterSalesReviewShopResolver = exports.AfterSalesReviewAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const after_sales_review_service_1 = require("./after-sales-review.service");
const permissions_1 = require("./permissions");
/** 商家端：退款后满意度汇总与低分跟进（§93） */
let AfterSalesReviewAdminResolver = class AfterSalesReviewAdminResolver {
    constructor(reviews) {
        this.reviews = reviews;
    }
    /** 满意度汇总（§93）：区间内均分/分档/低分待跟进 */
    async campusMerchantAfterSalesReviewSummary(ctx, from, to) {
        return this.reviews.summary(ctx, from, to);
    }
    /** 标记低分已跟进（§93） */
    async campusMerchantAfterSalesReviewFollowUp(ctx, id) {
        return this.reviews.markFollowed(ctx, id);
    }
};
exports.AfterSalesReviewAdminResolver = AfterSalesReviewAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('from')),
    __param(2, (0, graphql_1.Args)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], AfterSalesReviewAdminResolver.prototype, "campusMerchantAfterSalesReviewSummary", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusMerchant),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AfterSalesReviewAdminResolver.prototype, "campusMerchantAfterSalesReviewFollowUp", null);
exports.AfterSalesReviewAdminResolver = AfterSalesReviewAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [after_sales_review_service_1.AfterSalesReviewService])
], AfterSalesReviewAdminResolver);
/** C 端：退款完成后邀请顾客评分（§93） */
let AfterSalesReviewShopResolver = class AfterSalesReviewShopResolver {
    constructor(reviews) {
        this.reviews = reviews;
    }
    async campusSubmitAfterSalesReview(ctx, requestId, score, comment) {
        return this.reviews.submit(ctx, requestId, score, comment);
    }
};
exports.AfterSalesReviewShopResolver = AfterSalesReviewShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('requestId')),
    __param(2, (0, graphql_1.Args)({ name: 'score', type: () => graphql_1.Int })),
    __param(3, (0, graphql_1.Args)({ name: 'comment', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, Object]),
    __metadata("design:returntype", Promise)
], AfterSalesReviewShopResolver.prototype, "campusSubmitAfterSalesReview", null);
exports.AfterSalesReviewShopResolver = AfterSalesReviewShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [after_sales_review_service_1.AfterSalesReviewService])
], AfterSalesReviewShopResolver);
//# sourceMappingURL=after-sales-review.resolver.js.map