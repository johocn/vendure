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
exports.RiderLedgerAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const graphql_2 = require("graphql");
const permissions_1 = require("./permissions");
const rider_ledger_service_1 = require("./rider-ledger.service");
/** 骑手财务/轨迹只读查询（P8-4）：
 * 分成台账属财务对账 → CampusAuditRider；轨迹属调度追溯 → CampusViewDispatch。 */
let RiderLedgerAdminResolver = class RiderLedgerAdminResolver {
    constructor(ledger) {
        this.ledger = ledger;
    }
    async campusRiderEarnings(ctx, from, to, riderCustomerId, status, orderCode, skip, take) {
        return this.ledger.earningsLedger(ctx, { from, to, riderCustomerId, status, orderCode, skip, take });
    }
    async campusOrderRiderTrack(ctx, orderId, orderCode) {
        return this.ledger.orderTrack(ctx, orderId, orderCode);
    }
    async campusRiderTrack(ctx, riderCustomerId, from, to) {
        return this.ledger.riderTrack(ctx, riderCustomerId, from, to);
    }
};
exports.RiderLedgerAdminResolver = RiderLedgerAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusAuditRider),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'from', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'to', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'riderCustomerId', type: () => String, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __param(5, (0, graphql_1.Args)({ name: 'orderCode', type: () => String, nullable: true })),
    __param(6, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(7, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], RiderLedgerAdminResolver.prototype, "campusRiderEarnings", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusViewDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'orderId', type: () => graphql_2.GraphQLID, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'orderCode', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], RiderLedgerAdminResolver.prototype, "campusOrderRiderTrack", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusViewDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('riderCustomerId')),
    __param(2, (0, graphql_1.Args)({ name: 'from', type: () => String })),
    __param(3, (0, graphql_1.Args)({ name: 'to', type: () => String })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String]),
    __metadata("design:returntype", Promise)
], RiderLedgerAdminResolver.prototype, "campusRiderTrack", null);
exports.RiderLedgerAdminResolver = RiderLedgerAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [rider_ledger_service_1.RiderLedgerService])
], RiderLedgerAdminResolver);
//# sourceMappingURL=rider-ledger-admin.resolver.js.map