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
exports.AdminReportResolver = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const report_service_1 = require("../services/report.service");
/**
 * 报表查询 API（店长/老板维度）。
 *
 * 权限：复用 Vendure 原生 ReadOrder Permission（店长/老板角色默认拥有）。
 * 数据范围：ctx.channelId 自动过滤，仅返回当前 channel 数据。
 *
 * 四类报表对应四个 Query：
 * - todayOverview: 今日概览（实时）
 * - posSalesReport: 日/区间报表（按天趋势）—— 命名为 pos 前缀，避免与 sales-plugin 的 salesReport 重名冲突
 * - monthlyReport: 月度报表（含环比）
 * - topProducts: 商品销量 TOP
 */
let AdminReportResolver = class AdminReportResolver {
    constructor(reportService) {
        this.reportService = reportService;
    }
    async todayOverview(ctx) {
        return this.reportService.todayOverview(ctx);
    }
    async posSalesReport(ctx, startDate, endDate) {
        return this.reportService.salesReport(ctx, startDate, endDate);
    }
    async monthlyReport(ctx, year, month) {
        return this.reportService.monthlyReport(ctx, year, month);
    }
    async topProducts(ctx, startDate, endDate, limit = 20, sortBy = 'quantity') {
        return this.reportService.topProducts(ctx, startDate, endDate, limit, sortBy);
    }
};
exports.AdminReportResolver = AdminReportResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AdminReportResolver.prototype, "todayOverview", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('startDate')),
    __param(2, (0, graphql_1.Args)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], AdminReportResolver.prototype, "posSalesReport", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('year')),
    __param(2, (0, graphql_1.Args)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], AdminReportResolver.prototype, "monthlyReport", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('startDate')),
    __param(2, (0, graphql_1.Args)('endDate')),
    __param(3, (0, graphql_1.Args)('limit')),
    __param(4, (0, graphql_1.Args)('sortBy')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, Object, String]),
    __metadata("design:returntype", Promise)
], AdminReportResolver.prototype, "topProducts", null);
exports.AdminReportResolver = AdminReportResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(report_service_1.ReportService)),
    __metadata("design:paramtypes", [report_service_1.ReportService])
], AdminReportResolver);
//# sourceMappingURL=admin-report.resolver.js.map