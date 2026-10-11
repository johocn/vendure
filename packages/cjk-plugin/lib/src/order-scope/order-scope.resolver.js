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
exports.OrderScopeAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const order_scope_service_1 = require("./order-scope.service");
let OrderScopeAdminResolver = class OrderScopeAdminResolver {
    constructor(orderScopeService) {
        this.orderScopeService = orderScopeService;
    }
    async scopedOrders(ctx, filter, take, skip) {
        return this.orderScopeService.scopedOrders(ctx, filter !== null && filter !== void 0 ? filter : {}, take !== null && take !== void 0 ? take : 20, skip !== null && skip !== void 0 ? skip : 0);
    }
    async scopedOrderCounts(ctx, filters) {
        return this.orderScopeService.scopedOrderCounts(ctx, filters !== null && filters !== void 0 ? filters : []);
    }
    async newOrderSignal(ctx, since) {
        return this.orderScopeService.newOrderSignal(ctx, new Date(since));
    }
};
exports.OrderScopeAdminResolver = OrderScopeAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('filter', { nullable: true })),
    __param(2, (0, graphql_1.Args)('take', { nullable: true, type: () => Number })),
    __param(3, (0, graphql_1.Args)('skip', { nullable: true, type: () => Number })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], OrderScopeAdminResolver.prototype, "scopedOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('filters', { nullable: true, type: () => [Object] })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], OrderScopeAdminResolver.prototype, "scopedOrderCounts", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('since', { type: () => String })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], OrderScopeAdminResolver.prototype, "newOrderSignal", null);
exports.OrderScopeAdminResolver = OrderScopeAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [order_scope_service_1.OrderScopeService])
], OrderScopeAdminResolver);
//# sourceMappingURL=order-scope.resolver.js.map