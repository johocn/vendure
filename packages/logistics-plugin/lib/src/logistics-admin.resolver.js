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
exports.LogisticsAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const logistics_service_1 = require("./logistics.service");
const carrier_dictionary_1 = require("./carrier-dictionary");
let LogisticsAdminResolver = class LogisticsAdminResolver {
    constructor(logisticsService) {
        this.logisticsService = logisticsService;
    }
    async logisticsTracks(ctx, orderId) {
        const tracks = await this.logisticsService.getTracksByOrder(ctx, orderId);
        return tracks.map(t => this.toGraphQl(t));
    }
    async logisticsTrack(ctx, id) {
        const track = await this.logisticsService.findOne(ctx, id);
        return track ? this.toGraphQl(track) : null;
    }
    async carriers() {
        return carrier_dictionary_1.CARRIERS;
    }
    async batchCreateFulfillment(ctx, items) {
        const results = await this.logisticsService.batchCreateFulfillment(ctx, items.map((i) => ({
            orderId: i.orderId,
            trackingNo: i.trackingNo,
            carrierCode: i.carrierCode,
        })));
        return {
            items: results.map(r => {
                var _a;
                return ({
                    orderId: r.orderId,
                    success: r.success,
                    trackId: r.trackId,
                    error: (_a = r.error) !== null && _a !== void 0 ? _a : null,
                });
            }),
        };
    }
    async refreshTrack(ctx, id) {
        const track = await this.logisticsService.queryTrack(ctx, id);
        return this.toGraphQl(track);
    }
    toGraphQl(track) {
        return {
            id: track.id,
            fulfillmentId: track.fulfillmentId,
            trackingNo: track.trackingNo,
            carrierCode: track.carrierCode,
            carrierName: track.carrierCode,
            status: track.status,
            trackInfo: track.trackInfo,
            signedAt: track.signedAt,
            lastSyncedAt: track.lastSyncedAt,
        };
    }
};
exports.LogisticsAdminResolver = LogisticsAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], LogisticsAdminResolver.prototype, "logisticsTracks", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], LogisticsAdminResolver.prototype, "logisticsTrack", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LogisticsAdminResolver.prototype, "carriers", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('items')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], LogisticsAdminResolver.prototype, "batchCreateFulfillment", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], LogisticsAdminResolver.prototype, "refreshTrack", null);
exports.LogisticsAdminResolver = LogisticsAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [logistics_service_1.LogisticsService])
], LogisticsAdminResolver);
//# sourceMappingURL=logistics-admin.resolver.js.map