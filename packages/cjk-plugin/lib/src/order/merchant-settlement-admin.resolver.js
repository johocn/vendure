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
exports.MerchantSettlementAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const merchant_settlement_ledger_entity_1 = require("./merchant-settlement-ledger.entity");
/**
 * 商户分账台账管理端查询（web-admin 后续使用）。
 * 仅做只读查询，不在此处执行任何写入。
 */
let MerchantSettlementAdminResolver = class MerchantSettlementAdminResolver {
    constructor(connection) {
        this.connection = connection;
    }
    async merchantSettlementLedgers(ctx, orderId) {
        const repo = this.connection.getRepository(ctx, merchant_settlement_ledger_entity_1.MerchantSettlementLedger);
        const qb = repo.createQueryBuilder('l');
        // 全局渠道（superadmin）看全部；租户/门店管理按当前渠道隔离，只看本店台账
        if (Number(ctx.channelId) !== 1) {
            qb.where('l.tenantChannelId = :cid', { cid: String(ctx.channelId) });
        }
        if (orderId) {
            qb.andWhere('l.orderId = :oid', { oid: String(orderId) });
        }
        qb.orderBy('l.occurredAt', 'DESC').addOrderBy('l.id', 'DESC');
        return qb.getMany();
    }
};
exports.MerchantSettlementAdminResolver = MerchantSettlementAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], MerchantSettlementAdminResolver.prototype, "merchantSettlementLedgers", null);
exports.MerchantSettlementAdminResolver = MerchantSettlementAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], MerchantSettlementAdminResolver);
//# sourceMappingURL=merchant-settlement-admin.resolver.js.map