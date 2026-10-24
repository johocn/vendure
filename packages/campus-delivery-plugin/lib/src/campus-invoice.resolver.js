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
exports.InvoiceShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const INVOICE_ELIGIBLE_STATES = ['PaymentAuthorized', 'PaymentSettled', 'Shipped', 'Delivered'];
/**
 * C 端发票轻量闭环（个人中心 spec §3.3/§4）：
 * 对已支付的历史订单写 invoiceApplied/invoiceInfo customFields（Vendure updateOrderCustomFields
 * 只作用于 activeOrder，历史单不可用，故加本 mutation）。幂等：invoiceApplied=true 再调报错。
 * 商家线下人工开票，B 端本期不动。
 * 写路径用 OrderService.updateCustomFields（同 after-sales-plugin 惯例）：裸 repo save 会因
 * Order.discounts getter 缺 lines 关联报 500。
 */
let InvoiceShopResolver = class InvoiceShopResolver {
    constructor(dataSource, orderService) {
        this.dataSource = dataSource;
        this.orderService = orderService;
    }
    async applyOrderInvoice(ctx, orderId, invoiceInfo) {
        var _a, _b;
        if (!ctx.activeUserId) {
            throw new core_1.UserInputError('NOT_LOGGED_IN');
        }
        const order = await this.dataSource.getRepository(core_1.Order).findOne({
            where: { id: orderId },
            relations: ['customer'],
        });
        if (!order || !order.customer) {
            throw new core_1.UserInputError('ORDER_NOT_FOUND');
        }
        // Customer 实体无 userId 标量，归属比对必须走 user 关系（eager:true）
        const ownerId = (_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
        if (String(ownerId) !== String(ctx.activeUserId)) {
            throw new core_1.UserInputError('ORDER_NOT_FOUND');
        }
        const cf = (order.customFields || {});
        if (cf.invoiceApplied) {
            throw new core_1.UserInputError('INVOICE_ALREADY_APPLIED');
        }
        if (!INVOICE_ELIGIBLE_STATES.includes(order.state)) {
            throw new core_1.UserInputError('ORDER_NOT_PAID');
        }
        await this.orderService.updateCustomFields(ctx, orderId, { invoiceApplied: true, invoiceInfo });
        return true;
    }
};
exports.InvoiceShopResolver = InvoiceShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('invoiceInfo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], InvoiceShopResolver.prototype, "applyOrderInvoice", null);
exports.InvoiceShopResolver = InvoiceShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource, core_1.OrderService])
], InvoiceShopResolver);
//# sourceMappingURL=campus-invoice.resolver.js.map