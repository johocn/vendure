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
exports.CircleAdminResolver = exports.CircleShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const circle_service_1 = require("./circle.service");
let CircleShopResolver = class CircleShopResolver {
    constructor(circleService) {
        this.circleService = circleService;
    }
    /** 游客可浏览 feed（对齐 usemall），不加 @Allow。 */
    async circleFeed(ctx, options) {
        return this.circleService.feed(ctx, options);
    }
    async myCirclePosts(ctx, options) {
        return this.circleService.myPosts(ctx, options);
    }
    /** 游客可看详情，不加 @Allow。 */
    async circlePost(ctx, id) {
        return this.circleService.findOne(ctx, id);
    }
    async createCirclePost(ctx, input) {
        return this.circleService.createPost(ctx, input);
    }
    async toggleCircleLike(ctx, postId) {
        return this.circleService.toggleLike(ctx, postId);
    }
    async toggleCircleFavorite(ctx, postId) {
        return this.circleService.toggleFavorite(ctx, postId);
    }
};
exports.CircleShopResolver = CircleShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CircleShopResolver.prototype, "circleFeed", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CircleShopResolver.prototype, "myCirclePosts", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CircleShopResolver.prototype, "circlePost", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CircleShopResolver.prototype, "createCirclePost", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('postId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CircleShopResolver.prototype, "toggleCircleLike", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('postId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CircleShopResolver.prototype, "toggleCircleFavorite", null);
exports.CircleShopResolver = CircleShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [circle_service_1.CircleService])
], CircleShopResolver);
let CircleAdminResolver = class CircleAdminResolver {
    constructor(circleService) {
        this.circleService = circleService;
    }
    async circlePosts(ctx, options) {
        return this.circleService.adminFeed(ctx, options);
    }
    async updateCirclePost(ctx, input) {
        return this.circleService.updatePost(ctx, input);
    }
};
exports.CircleAdminResolver = CircleAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CircleAdminResolver.prototype, "circlePosts", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CircleAdminResolver.prototype, "updateCirclePost", null);
exports.CircleAdminResolver = CircleAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [circle_service_1.CircleService])
], CircleAdminResolver);
//# sourceMappingURL=circle.resolvers.js.map