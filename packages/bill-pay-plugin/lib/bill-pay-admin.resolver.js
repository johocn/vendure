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
exports.BillPayAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const bill_pay_service_1 = require("./bill-pay.service");
const constants_1 = require("./constants");
/**
 * 代买单工作台（admin-api）：改价、接单、凭证回传、结算、人工退款，
 * 以及商家协议 / 渠道配置维护。权限为自定义 BillPayManage（注册于 plugin configuration）。
 */
let BillPayAdminResolver = class BillPayAdminResolver {
    constructor(billPayService) {
        this.billPayService = billPayService;
    }
    async billPayOrdersAdmin(ctx, options) {
        var _a, _b, _c;
        const { items, totalItems } = await this.billPayService.adminList(ctx, {
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20,
            status: (_c = options === null || options === void 0 ? void 0 : options.status) !== null && _c !== void 0 ? _c : undefined,
        });
        return { items: items.map(o => this.billPayService.toGraph(o)), totalItems };
    }
    async billPayOrderAdmin(ctx, id) {
        return this.billPayService.toGraph(await this.billPayService.adminFind(ctx, id));
    }
    async billPayChannelConfig(ctx) {
        return this.billPayService.getRawChannelConfig(ctx);
    }
    async merchantAgreements(ctx) {
        return this.billPayService.listAgreements(ctx);
    }
    async updateBillPayQuote(ctx, id, quoteAmount, note) {
        return this.billPayService.toGraph(await this.billPayService.updateBillPayQuote(ctx, id, quoteAmount, note));
    }
    async acceptBillPayOrder(ctx, id) {
        return this.billPayService.toGraph(await this.billPayService.acceptBillPayOrder(ctx, id));
    }
    async completeBillPayOrder(ctx, id, actualAmount, proofUrl, note) {
        return this.billPayService.toGraph(await this.billPayService.completeBillPayOrder(ctx, id, actualAmount, proofUrl, note));
    }
    async settleBillPayOrder(ctx, id) {
        return this.billPayService.toGraph(await this.billPayService.settleBillPayOrder(ctx, id));
    }
    async refundBillPayOrder(ctx, id, reason) {
        return this.billPayService.toGraph(await this.billPayService.refundBillPayOrder(ctx, id, reason));
    }
    async saveMerchantAgreement(ctx, input, id) {
        return this.billPayService.saveAgreement(ctx, input, id);
    }
    async saveBillPayChannelConfig(ctx, config) {
        return this.billPayService.saveChannelConfig(ctx, config);
    }
};
exports.BillPayAdminResolver = BillPayAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "billPayOrdersAdmin", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "billPayOrderAdmin", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "billPayChannelConfig", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "merchantAgreements", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('quoteAmount')),
    __param(3, (0, graphql_1.Args)('note')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, String]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "updateBillPayQuote", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "acceptBillPayOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('actualAmount')),
    __param(3, (0, graphql_1.Args)('proofUrl')),
    __param(4, (0, graphql_1.Args)('note', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, String, String]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "completeBillPayOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "settleBillPayOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('reason', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "refundBillPayOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __param(2, (0, graphql_1.Args)('id', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "saveMerchantAgreement", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.BillPayPermissions.BillPayManage),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('config')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BillPayAdminResolver.prototype, "saveBillPayChannelConfig", null);
exports.BillPayAdminResolver = BillPayAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [bill_pay_service_1.BillPayService])
], BillPayAdminResolver);
//# sourceMappingURL=bill-pay-admin.resolver.js.map