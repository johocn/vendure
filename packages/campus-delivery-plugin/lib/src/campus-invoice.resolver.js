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
 * 写路径用条件 UPDATE（CAS）：先读后写会被并发双击/多端提交穿透，重复覆盖发票抬头。
 */
let InvoiceShopResolver = class InvoiceShopResolver {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async applyOrderInvoice(ctx, orderId, invoiceInfo) {
        var _a, _b;
        if (!ctx.activeUserId) {
            throw new core_1.UserInputError('NOT_LOGGED_IN');
        }
        // 入参收敛：发票信息为自由文本，限长防超大字段污染订单表/前端渲染
        const info = String(invoiceInfo !== null && invoiceInfo !== void 0 ? invoiceInfo : '').trim();
        if (!info) {
            throw new core_1.UserInputError('INVOICE_INFO_REQUIRED');
        }
        if (info.length > 500) {
            throw new core_1.UserInputError('INVOICE_INFO_TOO_LONG');
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
        // 条件写（CAS）：invoiceApplied 仍为 false 且订单仍在可开票状态才写入，并发双击只有一次成功
        const out = await this.dataSource.query('UPDATE "order" SET "customFieldsInvoiceapplied" = TRUE, "customFieldsInvoiceinfo" = $2 '
            + 'WHERE id = $1 AND COALESCE("customFieldsInvoiceapplied", FALSE) = FALSE '
            + 'AND "state" = ANY($3::text[]) RETURNING id', [orderId, info, INVOICE_ELIGIBLE_STATES]);
        const rows = Array.isArray(out) && Array.isArray(out[0]) ? out[0] : out;
        if (!Array.isArray(rows) || !rows.length) {
            throw new core_1.UserInputError('INVOICE_ALREADY_APPLIED');
        }
        return true;
    }
};
exports.InvoiceShopResolver = InvoiceShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('invoiceInfo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], InvoiceShopResolver.prototype, "applyOrderInvoice", null);
exports.InvoiceShopResolver = InvoiceShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], InvoiceShopResolver);
//# sourceMappingURL=campus-invoice.resolver.js.map