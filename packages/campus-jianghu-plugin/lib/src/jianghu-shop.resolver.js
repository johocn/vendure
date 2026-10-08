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
exports.JianghuShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const jianghu_service_1 = require("./jianghu.service");
const constants_1 = require("./constants");
let JianghuShopResolver = class JianghuShopResolver {
    constructor(service) {
        this.service = service;
    }
    jianghuProfile(ctx) {
        return this.service.myProfile(ctx);
    }
    jianghuRankLadder() {
        return constants_1.RANK_LADDER;
    }
    jianghuHall(ctx, args) {
        return this.service.hall(ctx, args.type, args.campusCode, args.cursor, args.limit, args.lat, args.lng);
    }
    jianghuTaskDetail(ctx, args) {
        return this.service.taskDetail(ctx, args.taskId);
    }
    jianghuMyRecords(ctx, args) {
        return this.service.myRecords(ctx, args.cursor, args.limit);
    }
    jianghuDailyRank(ctx, args) {
        return this.service.dailyRank(ctx, args.campusCode);
    }
    jianghuIntelMarket(ctx, args) {
        return this.service.intelMarket(ctx, args.campusCode, args.cursor, args.limit);
    }
    jianghuEventCurrent(ctx, args) {
        return this.service.eventCurrent(ctx, args.campusCode);
    }
    jianghuEventDetail(ctx) {
        return this.service.eventDetail(ctx);
    }
    jianghuEventContent(ctx) {
        return this.service.getEventContent(ctx);
    }
    jianghuTakeTask(ctx, args) {
        return this.service.take(ctx, args.taskId);
    }
    jianghuReleaseTask(ctx, args) {
        return this.service.release(ctx, args.taskId);
    }
    jianghuRefreshCode(ctx, args) {
        return this.service.refreshCode(ctx, args.taskId);
    }
    jianghuVerify(ctx, args) {
        return this.service.verify(ctx, args.taskId, args.code, args.lat, args.lng);
    }
    jianghuSubmitRumor(ctx, args) {
        return this.service.submitRumor(ctx, args.input);
    }
    jianghuUnlockIntel(ctx, args) {
        return this.service.unlockIntel(ctx, args.intelId);
    }
    jianghuCollectClue(ctx, args) {
        return this.service.collectClue(ctx, args.input);
    }
};
exports.JianghuShopResolver = JianghuShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuProfile", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuRankLadder", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuHall", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuTaskDetail", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuMyRecords", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuDailyRank", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuIntelMarket", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuEventCurrent", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuEventDetail", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuEventContent", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuTakeTask", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuReleaseTask", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuRefreshCode", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuVerify", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuSubmitRumor", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuUnlockIntel", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], JianghuShopResolver.prototype, "jianghuCollectClue", null);
exports.JianghuShopResolver = JianghuShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [jianghu_service_1.JianghuService])
], JianghuShopResolver);
//# sourceMappingURL=jianghu-shop.resolver.js.map