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
exports.AfterSalesShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const after_sales_service_1 = require("./after-sales.service");
let AfterSalesShopResolver = class AfterSalesShopResolver {
    constructor(afterSalesService) {
        this.afterSalesService = afterSalesService;
    }
    async myAfterSalesRequests(ctx, options) {
        return this.afterSalesService.findMyRequests(ctx, options);
    }
    async afterSalesRequest(ctx, id) {
        return this.afterSalesService.findOneForCustomer(ctx, id);
    }
    async createAfterSalesRequest(ctx, input) {
        return this.afterSalesService.createRequest(ctx, input);
    }
    async cancelAfterSalesRequest(ctx, id) {
        return this.afterSalesService.cancelRequest(ctx, id);
    }
    async updateReturnTracking(ctx, id, trackingNo, carrier) {
        return this.afterSalesService.updateReturnTracking(ctx, id, trackingNo, carrier);
    }
};
exports.AfterSalesShopResolver = AfterSalesShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AfterSalesShopResolver.prototype, "myAfterSalesRequests", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], AfterSalesShopResolver.prototype, "afterSalesRequest", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AfterSalesShopResolver.prototype, "createAfterSalesRequest", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], AfterSalesShopResolver.prototype, "cancelAfterSalesRequest", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('trackingNo')),
    __param(3, (0, graphql_1.Args)('carrier')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, String, String]),
    __metadata("design:returntype", Promise)
], AfterSalesShopResolver.prototype, "updateReturnTracking", null);
exports.AfterSalesShopResolver = AfterSalesShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [after_sales_service_1.AfterSalesService])
], AfterSalesShopResolver);
//# sourceMappingURL=after-sales-shop.resolver.js.map