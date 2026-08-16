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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
let SettlementService = class SettlementService {
    constructor(connection) {
        this.connection = connection;
    }
    async getMerchantChannel(ctx, merchantChannelId) {
        return this.connection.getRepository(ctx, core_1.Channel).findOne({
            where: { id: merchantChannelId },
        });
    }
    getStatesForBasis(basis) {
        if (basis === 'completed') {
            return ['Delivered', 'Shipped'];
        }
        return ['PaymentSettled', 'PaymentAuthorized'];
    }
    buildQueryBuilder(ctx, merchantChannelId) {
        return this.connection.rawConnection
            .getRepository(core_1.Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('order.customFields.saleSource = :saleSource', {
            saleSource: constants_1.SALE_SOURCE_MARKETPLACE,
        })
            .andWhere('channel.id = :channelId', { channelId: merchantChannelId });
    }
    /**
     * 对账：按 saleSource=marketplace 汇总指定商家 Channel 的订单，
     * 依据 settlementBasis（paid/completed）过滤订单状态。
     */
    async exportMerchantSettlement(ctx, merchantChannelId, from, to) {
        var _a, _b;
        const channel = await this.getMerchantChannel(ctx, merchantChannelId);
        const basis = (_b = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _a === void 0 ? void 0 : _a.settlementBasis) !== null && _b !== void 0 ? _b : 'paid';
        const states = this.getStatesForBasis(basis);
        const qb = this.buildQueryBuilder(ctx, merchantChannelId).andWhere('order.state IN (:...states)', {
            states,
        });
        if (from) {
            qb.andWhere('order.orderPlacedAt >= :from', { from });
        }
        if (to) {
            qb.andWhere('order.orderPlacedAt <= :to', { to });
        }
        const orders = await qb.orderBy('order.orderPlacedAt', 'ASC').getMany();
        return orders.map(order => ({
            orderId: order.id,
            orderCode: order.code,
            state: order.state,
            totalWithTax: order.totalWithTax,
            currencyCode: order.currencyCode,
            orderPlacedAt: order.orderPlacedAt,
            merchantChannelId: merchantChannelId,
        }));
    }
    /** 商家订单查询（含对账状态过滤所需的基础信息） */
    async listMerchantOrders(ctx, merchantChannelId, from, to) {
        const qb = this.buildQueryBuilder(ctx, merchantChannelId);
        if (from) {
            qb.andWhere('order.orderPlacedAt >= :from', { from });
        }
        if (to) {
            qb.andWhere('order.orderPlacedAt <= :to', { to });
        }
        return qb.orderBy('order.orderPlacedAt', 'DESC').getMany();
    }
};
exports.SettlementService = SettlementService;
exports.SettlementService = SettlementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], SettlementService);
