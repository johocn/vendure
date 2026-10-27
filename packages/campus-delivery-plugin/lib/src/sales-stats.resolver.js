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
exports.SalesStatsResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const sales_stats_service_1 = require("./sales-stats.service");
const permissions_1 = require("./permissions");
let SalesStatsResolver = class SalesStatsResolver {
    constructor(stats) {
        this.stats = stats;
    }
    /** 销售侧经营 BI（P4-1）：今日/7日/30日，KPI+环比+时段热力+菜品四象限+复购分群 */
    async campusSalesStats(ctx, range) {
        return this.stats.stats(ctx, range);
    }
};
exports.SalesStatsResolver = SalesStatsResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusViewDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'range', nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], SalesStatsResolver.prototype, "campusSalesStats", null);
exports.SalesStatsResolver = SalesStatsResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [sales_stats_service_1.SalesStatsService])
], SalesStatsResolver);
//# sourceMappingURL=sales-stats.resolver.js.map