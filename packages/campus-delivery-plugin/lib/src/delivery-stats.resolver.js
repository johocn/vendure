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
exports.DeliveryStatsResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const delivery_stats_service_1 = require("./delivery-stats.service");
const permissions_1 = require("./permissions");
let DeliveryStatsResolver = class DeliveryStatsResolver {
    constructor(stats) {
        this.stats = stats;
    }
    /** 配送数据看板（方案 A）：today/7d/30d 三档窗口，KPI+趋势+环节+归因+店铺对比 */
    async campusDeliveryStats(ctx, range) {
        return this.stats.stats(ctx, range);
    }
};
exports.DeliveryStatsResolver = DeliveryStatsResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusViewDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'range', nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], DeliveryStatsResolver.prototype, "campusDeliveryStats", null);
exports.DeliveryStatsResolver = DeliveryStatsResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [delivery_stats_service_1.DeliveryStatsService])
], DeliveryStatsResolver);
//# sourceMappingURL=delivery-stats.resolver.js.map