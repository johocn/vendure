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
exports.DirectPaymentResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
let DirectPaymentResolver = class DirectPaymentResolver {
    constructor(orderService, customerService, connection) {
        this.orderService = orderService;
        this.customerService = customerService;
        this.connection = connection;
    }
    async payMarketplaceSellerOrder(ctx, args) {
        var _a;
        if (!ctx.activeUserId) {
            return { __typename: 'NoActiveOrderError', errorCode: 'NO_ACTIVE_ORDER', message: '未登录' };
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId, false);
        if (!customer) {
            return { __typename: 'NoActiveOrderError', errorCode: 'NO_ACTIVE_ORDER', message: '未找到顾客' };
        }
        const order = await this.orderService.findOne(ctx, args.orderId, ['customer', 'channels']);
        if (!order) {
            throw new core_1.EntityNotFoundError('Order', args.orderId);
        }
        // 校验订单归属当前顾客
        if (!order.customer || order.customer.id !== customer.id) {
            throw new core_1.EntityNotFoundError('Order', args.orderId);
        }
        // 仅允许 marketplace 商家子单通过此入口支付
        if (order.customFields.saleSource !== constants_1.SALE_SOURCE_MARKETPLACE) {
            return {
                __typename: 'OrderPaymentStateError',
                errorCode: 'ORDER_PAYMENT_STATE',
                message: '非 marketplace 商家子单，不可在此支付',
            };
        }
        const result = await this.orderService.addPaymentToOrder(ctx, order.id, {
            method: args.method,
            metadata: (_a = args.metadata) !== null && _a !== void 0 ? _a : {},
        });
        if ((0, core_1.isGraphQlErrorResult)(result)) {
            return Object.assign(Object.assign({}, result), { __typename: 'OrderPaymentStateError', errorCode: result.errorCode });
        }
        return Object.assign(Object.assign({}, result), { __typename: 'Order' });
    }
    async myMarketplaceSellerOrders(ctx) {
        if (!ctx.activeUserId) {
            return [];
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId, false);
        if (!customer) {
            return [];
        }
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.channels', 'channel')
            .leftJoinAndSelect('channel.seller', 'sellerChannel')
            .leftJoinAndSelect('order.lines', 'line')
            .leftJoinAndSelect('line.productVariant', 'productVariant')
            .where('order.customFields.saleSource = :saleSource', {
            saleSource: constants_1.SALE_SOURCE_MARKETPLACE,
        })
            .andWhere('customer.id = :customerId', { customerId: customer.id })
            .andWhere('order.state != :draftState', { draftState: 'Draft' })
            .orderBy('order.orderPlacedAt', 'DESC');
        const orders = await qb.getMany();
        return orders.map(order => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return ({
                id: order.id,
                code: order.code,
                state: order.state,
                totalWithTax: order.totalWithTax,
                sellerChannelName: (_g = (_d = (_c = (_b = (_a = order.channels) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.seller) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : (_f = (_e = order.channels) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.code) !== null && _g !== void 0 ? _g : null,
                lines: ((_h = order.lines) !== null && _h !== void 0 ? _h : []).map(line => {
                    var _a, _b;
                    return ({
                        id: line.id,
                        productName: (_b = (_a = line.productVariant) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '',
                        quantity: line.quantity,
                        unitPriceWithTax: line.unitPriceWithTax,
                        linePriceWithTax: line.linePriceWithTax,
                    });
                }),
            });
        });
    }
};
exports.DirectPaymentResolver = DirectPaymentResolver;
__decorate([
    (0, graphql_1.Mutation)('payMarketplaceSellerOrder'),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DirectPaymentResolver.prototype, "payMarketplaceSellerOrder", null);
__decorate([
    (0, graphql_1.Query)('myMarketplaceSellerOrders'),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], DirectPaymentResolver.prototype, "myMarketplaceSellerOrders", null);
exports.DirectPaymentResolver = DirectPaymentResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.OrderService,
        core_1.CustomerService,
        core_1.TransactionalConnection])
], DirectPaymentResolver);
