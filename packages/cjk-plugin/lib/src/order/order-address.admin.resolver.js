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
exports.OrderAddressAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
/**
 * 改订单收货地址。
 * 注意：Vendure 自带的 setOrderShippingAddress 只在 shop-api 且只作用于活动订单，
 * 后台改已下单订单必须走这里。**不重算运费**（设计 §3 非目标）。
 *
 * Vendure 3.x 的 `Order.shippingAddress` 是 `simple-json` 列（非独立实体），
 * 因此这里做定向 update，避免整单 save 触发额外副作用。
 */
let OrderAddressAdminResolver = class OrderAddressAdminResolver {
    constructor(connection) {
        this.connection = connection;
    }
    async updateOrderShippingAddress(ctx, orderId, input) {
        var _a;
        const repo = this.connection.getRepository(ctx, core_1.Order);
        const order = await repo.findOne({ where: { id: Number(orderId) } });
        if (!order)
            throw new core_1.UserInputError(`订单 ${orderId} 不存在`);
        const current = ((_a = order.shippingAddress) !== null && _a !== void 0 ? _a : null);
        if (!current)
            throw new core_1.UserInputError('该订单没有收货地址，无法修改');
        const next = Object.assign({}, current);
        for (const key of [
            'fullName',
            'phoneNumber',
            'province',
            'city',
            'streetLine1',
            'streetLine2',
            'postalCode',
            'countryCode',
        ]) {
            if (input[key] !== undefined && input[key] !== null)
                next[key] = input[key];
        }
        // 故意不动 shippingLine / surcharges：仓管只是修正门牌，不应触发运费变更
        await repo.update(order.id, { shippingAddress: next });
        return {
            id: String(order.id),
            code: order.code,
            shippingAddress: next,
        };
    }
};
exports.OrderAddressAdminResolver = OrderAddressAdminResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], OrderAddressAdminResolver.prototype, "updateOrderShippingAddress", null);
exports.OrderAddressAdminResolver = OrderAddressAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], OrderAddressAdminResolver);
//# sourceMappingURL=order-address.admin.resolver.js.map