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
exports.LogisticsShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const logistics_service_1 = require("./logistics.service");
let LogisticsShopResolver = class LogisticsShopResolver {
    constructor(logisticsService) {
        this.logisticsService = logisticsService;
    }
    async myOrderTracks(ctx, orderId) {
        const tracks = await this.logisticsService.getMyOrderTracks(ctx, orderId);
        return tracks.map(t => ({
            id: t.id,
            fulfillmentId: t.fulfillmentId,
            trackingNo: t.trackingNo,
            carrierCode: t.carrierCode,
            carrierName: t.carrierCode,
            status: t.status,
            trackInfo: t.trackInfo,
            signedAt: t.signedAt,
            lastSyncedAt: t.lastSyncedAt,
        }));
    }
};
exports.LogisticsShopResolver = LogisticsShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], LogisticsShopResolver.prototype, "myOrderTracks", null);
exports.LogisticsShopResolver = LogisticsShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [logistics_service_1.LogisticsService])
], LogisticsShopResolver);
//# sourceMappingURL=logistics-shop.resolver.js.map