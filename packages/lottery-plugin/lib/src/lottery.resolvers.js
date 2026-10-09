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
exports.LotteryAdminResolver = exports.LotteryShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const lottery_service_1 = require("./lottery.service");
let LotteryShopResolver = class LotteryShopResolver {
    constructor(lotteryService) {
        this.lotteryService = lotteryService;
    }
    /** 未登录可看奖品列表（C 端九宫格渲染），不加 @Allow。 */
    async myLotteryPrizes(ctx) {
        return this.lotteryService.myPrizes(ctx);
    }
    async myLotteryRecords(ctx, options) {
        return this.lotteryService.myRecords(ctx, options);
    }
    async drawLottery(ctx) {
        return this.lotteryService.draw(ctx);
    }
};
exports.LotteryShopResolver = LotteryShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], LotteryShopResolver.prototype, "myLotteryPrizes", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LotteryShopResolver.prototype, "myLotteryRecords", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], LotteryShopResolver.prototype, "drawLottery", null);
exports.LotteryShopResolver = LotteryShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [lottery_service_1.LotteryService])
], LotteryShopResolver);
let LotteryAdminResolver = class LotteryAdminResolver {
    constructor(lotteryService) {
        this.lotteryService = lotteryService;
    }
    async lotteryPrizes(ctx, options) {
        return this.lotteryService.adminPrizes(ctx, options);
    }
    async lotteryRecords(ctx, options) {
        return this.lotteryService.adminRecords(ctx, options);
    }
    async createLotteryPrize(ctx, input) {
        return this.lotteryService.createPrize(ctx, input);
    }
    async updateLotteryPrize(ctx, input) {
        return this.lotteryService.updatePrize(ctx, input);
    }
    async deleteLotteryPrize(ctx, id) {
        return this.lotteryService.deletePrize(ctx, id);
    }
};
exports.LotteryAdminResolver = LotteryAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LotteryAdminResolver.prototype, "lotteryPrizes", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LotteryAdminResolver.prototype, "lotteryRecords", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LotteryAdminResolver.prototype, "createLotteryPrize", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LotteryAdminResolver.prototype, "updateLotteryPrize", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LotteryAdminResolver.prototype, "deleteLotteryPrize", null);
exports.LotteryAdminResolver = LotteryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [lottery_service_1.LotteryService])
], LotteryAdminResolver);
//# sourceMappingURL=lottery.resolvers.js.map