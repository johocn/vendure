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
exports.CommunityLeaderResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const community_service_1 = require("./community.service");
let CommunityLeaderResolver = class CommunityLeaderResolver {
    constructor(service) {
        this.service = service;
    }
    async myActivities(ctx, args) {
        return this.service.myActivities(ctx, args.options);
    }
    async myCommission(ctx) {
        return this.service.myCommission(ctx);
    }
    async applyLeader(ctx, pickupLocationId) {
        return this.service.applyLeader(ctx, pickupLocationId);
    }
    async createActivity(ctx, input) {
        return this.service.createActivity(ctx, input);
    }
};
exports.CommunityLeaderResolver = CommunityLeaderResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CommunityLeaderResolver.prototype, "myActivities", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CommunityLeaderResolver.prototype, "myCommission", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('pickupLocationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CommunityLeaderResolver.prototype, "applyLeader", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CommunityLeaderResolver.prototype, "createActivity", null);
exports.CommunityLeaderResolver = CommunityLeaderResolver = __decorate([
    (0, graphql_1.Resolver)('CommunityActivity'),
    __metadata("design:paramtypes", [community_service_1.CommunityService])
], CommunityLeaderResolver);
//# sourceMappingURL=community-leader.resolver.js.map