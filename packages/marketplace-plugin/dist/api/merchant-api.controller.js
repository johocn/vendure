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
exports.MerchantApiController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const settlement_service_1 = require("../settlement.service");
/**
 * 商家对账 / 订单查询 REST API。
 *
 * 鉴权：校验 `Authorization: Bearer <channelToken>`，其中 channelToken 即该商家
 * Channel 的 token（注册商家时生成，格式如 `${shopCode}-token`）。
 * 通过 ChannelService.getChannelFromToken 将 token 解析为商家 Channel。
 *
 * 注意：当前实现依赖 Channel token 作为共享密钥，未接入 Vendure 的完整
 * JWT/APIKey 鉴权体系。如需更严格的鉴权，可在此基础上接入
 * JwtStrategy / ApiKey 校验。
 */
let MerchantApiController = class MerchantApiController {
    constructor(channelService, settlementService) {
        this.channelService = channelService;
        this.settlementService = settlementService;
    }
    async resolveChannel(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Missing or invalid Authorization header');
        }
        const token = authHeader.slice('Bearer '.length).trim();
        if (!token) {
            throw new common_1.UnauthorizedException('Missing channel token');
        }
        const channel = await this.channelService.getChannelFromToken(token);
        if (!channel) {
            throw new common_1.UnauthorizedException('Invalid channel token');
        }
        return channel;
    }
    buildCtx(channel) {
        return new core_1.RequestContext({
            apiType: 'admin',
            channel: channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }
    /** 对账单：GET /merchant-api/settlement?from=ISO&to=ISO */
    async settlement(authHeader, from, to) {
        const channel = await this.resolveChannel(authHeader);
        const fromDate = from ? new Date(from) : undefined;
        const toDate = to ? new Date(to) : undefined;
        const ctx = this.buildCtx(channel);
        const entries = await this.settlementService.exportMerchantSettlement(ctx, channel.id, fromDate, toDate);
        const total = entries.reduce((sum, e) => sum + e.totalWithTax, 0);
        return { count: entries.length, totalWithTax: total, entries };
    }
    /** 订单查询：GET /merchant-api/orders?from=ISO&to=ISO */
    async orders(authHeader, from, to) {
        const channel = await this.resolveChannel(authHeader);
        const fromDate = from ? new Date(from) : undefined;
        const toDate = to ? new Date(to) : undefined;
        const ctx = this.buildCtx(channel);
        const orders = await this.settlementService.listMerchantOrders(ctx, channel.id, fromDate, toDate);
        return {
            count: orders.length,
            items: orders.map(o => ({
                orderId: o.id,
                orderCode: o.code,
                state: o.state,
                totalWithTax: o.totalWithTax,
                currencyCode: o.currencyCode,
                orderPlacedAt: o.orderPlacedAt,
            })),
        };
    }
};
exports.MerchantApiController = MerchantApiController;
__decorate([
    (0, common_1.Get)('settlement'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MerchantApiController.prototype, "settlement", null);
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MerchantApiController.prototype, "orders", null);
exports.MerchantApiController = MerchantApiController = __decorate([
    (0, common_1.Controller)('merchant-api'),
    __metadata("design:paramtypes", [core_1.ChannelService,
        settlement_service_1.SettlementService])
], MerchantApiController);
