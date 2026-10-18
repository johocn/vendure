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
exports.BillPayShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const bill_pay_service_1 = require("./bill-pay.service");
/**
 * 代买单（shop-api）：客户提交委托、取消、支付（微信/余额）、我的委托单。
 * 归属校验（本人/本渠道）在 BillPayService 内完成；自动报价在创建时同步返回。
 */
let BillPayShopResolver = class BillPayShopResolver {
    constructor(billPayService) {
        this.billPayService = billPayService;
    }
    async billPayOrder(ctx, id) {
        return this.billPayService.toGraph(await this.billPayService.findOwnedBillPayOrder(ctx, id));
    }
    async billPayOrders(ctx, options) {
        var _a;
        const statuses = (options === null || options === void 0 ? void 0 : options.status) ? [options.status] : undefined;
        const items = await this.billPayService.myBillPayOrders(ctx, statuses);
        const take = Math.min(100, Math.max(1, (_a = options === null || options === void 0 ? void 0 : options.take) !== null && _a !== void 0 ? _a : 20));
        return { items: items.slice(0, take).map(o => this.billPayService.toGraph(o)), totalItems: items.length };
    }
    async billPayConfig(ctx) {
        return this.billPayService.getChannelConfig(ctx);
    }
    async createBillPayOrder(ctx, input) {
        return this.billPayService.toGraph(await this.billPayService.createBillPayOrder(ctx, input));
    }
    async cancelBillPayOrder(ctx, id) {
        return this.billPayService.toGraph(await this.billPayService.cancelBillPayOrder(ctx, id));
    }
    async createWechatBillPayment(ctx, id, tradeType, openid) {
        const tt = (tradeType !== null && tradeType !== void 0 ? tradeType : 'JSAPI');
        return this.billPayService.createWechatBillPayment(ctx, id, tt, openid);
    }
    async payBillPayOrderWithBalance(ctx, id) {
        return this.billPayService.toGraph(await this.billPayService.payBillPayOrderWithBalance(ctx, id));
    }
};
exports.BillPayShopResolver = BillPayShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayShopResolver.prototype, "billPayOrder", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayShopResolver.prototype, "billPayOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], BillPayShopResolver.prototype, "billPayConfig", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayShopResolver.prototype, "createBillPayOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayShopResolver.prototype, "cancelBillPayOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('tradeType', { nullable: true })),
    __param(3, (0, graphql_1.Args)('openid', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String]),
    __metadata("design:returntype", Promise)
], BillPayShopResolver.prototype, "createWechatBillPayment", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayShopResolver.prototype, "payBillPayOrderWithBalance", null);
exports.BillPayShopResolver = BillPayShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [bill_pay_service_1.BillPayService])
], BillPayShopResolver);
//# sourceMappingURL=bill-pay-shop.resolver.js.map