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
exports.FeedbackAdminResolver = exports.FeedbackShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const feedback_service_1 = require("./feedback.service");
let FeedbackShopResolver = class FeedbackShopResolver {
    constructor(feedbackService) {
        this.feedbackService = feedbackService;
    }
    /** 未登录可看 FAQ（对齐 usemall），不加 @Allow。lang 直传前端 locale（CONTENT_LOCALES 白名单外回退基线）。 */
    async faqs(ctx, type, lang) {
        return this.feedbackService.faqs(ctx, type, lang);
    }
    async myFeedbacks(ctx, options) {
        return this.feedbackService.myFeedbacks(ctx, options);
    }
    async createFeedback(ctx, input) {
        return this.feedbackService.createFeedback(ctx, input);
    }
    /** 全部可读反馈标记已读（幂等），返回最新未读数。 */
    async markFeedbacksRead(ctx) {
        return this.feedbackService.markFeedbacksRead(ctx);
    }
    /** 未读数 = readAt 为空且状态非 pending。 */
    async unreadFeedbackCount(ctx) {
        return this.feedbackService.unreadFeedbackCount(ctx);
    }
};
exports.FeedbackShopResolver = FeedbackShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('type', { nullable: true })),
    __param(2, (0, graphql_1.Args)('lang', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], FeedbackShopResolver.prototype, "faqs", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], FeedbackShopResolver.prototype, "myFeedbacks", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], FeedbackShopResolver.prototype, "createFeedback", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], FeedbackShopResolver.prototype, "markFeedbacksRead", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], FeedbackShopResolver.prototype, "unreadFeedbackCount", null);
exports.FeedbackShopResolver = FeedbackShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [feedback_service_1.FeedbackService])
], FeedbackShopResolver);
let FeedbackAdminResolver = class FeedbackAdminResolver {
    constructor(feedbackService) {
        this.feedbackService = feedbackService;
    }
    async faqEntries(ctx, options) {
        return this.feedbackService.adminFaqs(ctx, options);
    }
    async feedbacks(ctx, options) {
        return this.feedbackService.adminFeedbacks(ctx, options);
    }
    async saveFaq(ctx, input) {
        return this.feedbackService.saveFaq(ctx, input);
    }
    async deleteFaq(ctx, id) {
        return this.feedbackService.deleteFaq(ctx, id);
    }
    async updateFeedbackStatus(ctx, id, status) {
        return this.feedbackService.updateFeedbackStatus(ctx, id, status);
    }
    /** 回复反馈：resolve=true 直接 resolved；否则 pending 转 processing。仅 pending/processing 可回复。 */
    async replyFeedback(ctx, id, reply, resolve) {
        return this.feedbackService.replyFeedback(ctx, String(id), reply, resolve !== null && resolve !== void 0 ? resolve : false);
    }
};
exports.FeedbackAdminResolver = FeedbackAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], FeedbackAdminResolver.prototype, "faqEntries", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], FeedbackAdminResolver.prototype, "feedbacks", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], FeedbackAdminResolver.prototype, "saveFaq", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], FeedbackAdminResolver.prototype, "deleteFaq", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], FeedbackAdminResolver.prototype, "updateFeedbackStatus", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('reply')),
    __param(3, (0, graphql_1.Args)('resolve', { nullable: true, defaultValue: false })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, Boolean]),
    __metadata("design:returntype", Promise)
], FeedbackAdminResolver.prototype, "replyFeedback", null);
exports.FeedbackAdminResolver = FeedbackAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [feedback_service_1.FeedbackService])
], FeedbackAdminResolver);
//# sourceMappingURL=feedback.resolvers.js.map