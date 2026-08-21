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
exports.PreSaleShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const pre_sale_service_1 = require("./pre-sale.service");
let PreSaleShopResolver = class PreSaleShopResolver {
    constructor(preSaleService) {
        this.preSaleService = preSaleService;
    }
    async activePreSaleActivities(ctx) {
        const result = await this.preSaleService.findActive(ctx);
        return result !== null && result !== void 0 ? result : [];
    }
    async applyPreSale(ctx, activityId) {
        return this.preSaleService.applyPreSale(ctx, activityId);
    }
    async payPreSaleFull(ctx, orderId, method) {
        return this.preSaleService.payPreSaleFull(ctx, orderId, method);
    }
    async payPreSaleDeposit(ctx, orderId, method) {
        return this.preSaleService.payPreSaleDeposit(ctx, orderId, method);
    }
    async payPreSaleTail(ctx, orderId, method) {
        return this.preSaleService.payPreSaleTail(ctx, orderId, method);
    }
};
exports.PreSaleShopResolver = PreSaleShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], PreSaleShopResolver.prototype, "activePreSaleActivities", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('activityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PreSaleShopResolver.prototype, "applyPreSale", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('method')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], PreSaleShopResolver.prototype, "payPreSaleFull", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('method')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], PreSaleShopResolver.prototype, "payPreSaleDeposit", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('method')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], PreSaleShopResolver.prototype, "payPreSaleTail", null);
exports.PreSaleShopResolver = PreSaleShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [pre_sale_service_1.PreSaleService])
], PreSaleShopResolver);
//# sourceMappingURL=pre-sale-shop.resolver.js.map