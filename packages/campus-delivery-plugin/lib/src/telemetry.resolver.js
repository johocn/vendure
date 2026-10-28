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
exports.TelemetryAdminResolver = exports.TelemetryShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const permissions_1 = require("./permissions");
const telemetry_service_1 = require("./telemetry.service");
/** C 端埋点 / 错误上报（匿名可用，按渠道隔离）。 */
let TelemetryShopResolver = class TelemetryShopResolver {
    constructor(telemetry) {
        this.telemetry = telemetry;
    }
    async campusTrackEvents(ctx, input) {
        return this.telemetry.trackEvents(ctx, input);
    }
    async campusReportError(ctx, input) {
        return this.telemetry.reportError(ctx, input);
    }
};
exports.TelemetryShopResolver = TelemetryShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TelemetryShopResolver.prototype, "campusTrackEvents", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TelemetryShopResolver.prototype, "campusReportError", null);
exports.TelemetryShopResolver = TelemetryShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [telemetry_service_1.TelemetryService])
], TelemetryShopResolver);
/** 后台「系统监控」：KPI / 近 7 日趋势 / Top 事件 / 埋点与错误明细。 */
let TelemetryAdminResolver = class TelemetryAdminResolver {
    constructor(telemetry) {
        this.telemetry = telemetry;
    }
    async campusTrackEventStats(ctx) {
        return this.telemetry.stats(ctx);
    }
    async campusTrackEventList(ctx, eventName, skip, take) {
        return this.telemetry.events(ctx, { filter: eventName, skip, take });
    }
    async campusErrorReportList(ctx, level, skip, take) {
        return this.telemetry.errors(ctx, { filter: level, skip, take });
    }
};
exports.TelemetryAdminResolver = TelemetryAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusViewDispatch),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], TelemetryAdminResolver.prototype, "campusTrackEventStats", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusViewDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'eventName', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], TelemetryAdminResolver.prototype, "campusTrackEventList", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusViewDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'level', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], TelemetryAdminResolver.prototype, "campusErrorReportList", null);
exports.TelemetryAdminResolver = TelemetryAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [telemetry_service_1.TelemetryService])
], TelemetryAdminResolver);
//# sourceMappingURL=telemetry.resolver.js.map