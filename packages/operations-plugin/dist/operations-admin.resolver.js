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
exports.OperationsAdminResolver = void 0;
// e:\code\vendure\packages\operations-plugin\src\operations-admin.resolver.ts
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const content_service_1 = require("./content.service");
const operations_dashboard_service_1 = require("./operations-dashboard.service");
/**
 * @description
 * Operations Admin API Resolver (schema-first mode).
 *
 * Permission mapping:
 * - dashboardOverview / salesTrend / categoryTop → ViewDashboard (@Allow)
 * - contentItems / contentItem → dynamic by type (manual auth)
 * - createContentItem / updateContentItem / deleteContentItem → dynamic by type (manual auth)
 */
let OperationsAdminResolver = class OperationsAdminResolver {
    constructor(dashboardService, contentService) {
        this.dashboardService = dashboardService;
        this.contentService = contentService;
    }
    // ===== Dashboard =====
    async dashboardOverview(ctx, range) {
        const validRanges = ['today', 'yesterday', 'week', 'month'];
        if (!validRanges.includes(range)) {
            throw new Error(`Invalid range: must be one of ${validRanges.join('/')}`);
        }
        return this.dashboardService.getDashboardOverview(ctx, range);
    }
    async salesTrend(ctx, days) {
        const validDays = [7, 30];
        if (!validDays.includes(days)) {
            throw new Error('days must be 7 or 30');
        }
        return this.dashboardService.getSalesTrend(ctx, days);
    }
    async categoryTop(ctx, days) {
        const validDays = [7, 30];
        if (!validDays.includes(days)) {
            throw new Error('days must be 7 or 30');
        }
        return this.dashboardService.getCategoryTop(ctx, days);
    }
    // ===== CMS (dynamic permission by type) =====
    async contentItems(ctx, type, position, enabled, page, pageSize) {
        this.assertContentPermission(ctx, type);
        return this.contentService.findContentItems(ctx, { type, position, enabled, page, pageSize });
    }
    async contentItem(ctx, id) {
        // Permission checked after fetching item (need to know type)
        const item = await this.contentService.findOneContentItem(ctx, id);
        if (!item)
            return null;
        this.assertContentPermission(ctx, item.type);
        return item;
    }
    async createContentItem(ctx, input) {
        this.assertContentPermission(ctx, input.type);
        return this.contentService.createContentItem(ctx, input);
    }
    async updateContentItem(ctx, id, input) {
        // Permission checked after fetching item (need to know type)
        const item = await this.contentService.findOneContentItem(ctx, id);
        if (!item) {
            throw new Error('Content item not found');
        }
        this.assertContentPermission(ctx, item.type);
        return this.contentService.updateContentItem(ctx, id, input);
    }
    async deleteContentItem(ctx, id) {
        const item = await this.contentService.findOneContentItem(ctx, id);
        if (!item) {
            throw new Error('Content item not found');
        }
        this.assertContentPermission(ctx, item.type);
        return this.contentService.deleteContentItem(ctx, id);
    }
    // ===== Manual lifecycle trigger (admin/testing) =====
    async triggerContentLifecycle(ctx) {
        return this.contentService.runLifecycleCheck(ctx);
    }
    // ===== Dynamic permission check =====
    assertContentPermission(ctx, type) {
        const requiredPerm = this.getPermissionByType(type);
        if (!ctx.userHasPermissions([requiredPerm])) {
            throw new core_1.ForbiddenError();
        }
    }
    getPermissionByType(type) {
        switch (type) {
            case 'Banner':
                return constants_1.OperationsPermissions.ManageBanner;
            case 'Recommendation':
                return constants_1.OperationsPermissions.ManageRecommendation;
            case 'Notice':
                return constants_1.OperationsPermissions.ManageNotice;
            case 'Floor':
                return constants_1.OperationsPermissions.ManageFloor;
            default:
                return constants_1.OperationsPermissions.ManageContent;
        }
    }
};
exports.OperationsAdminResolver = OperationsAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.OperationsPermissions.ViewDashboard),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('range')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], OperationsAdminResolver.prototype, "dashboardOverview", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.OperationsPermissions.ViewDashboard),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], OperationsAdminResolver.prototype, "salesTrend", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.OperationsPermissions.ViewDashboard),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], OperationsAdminResolver.prototype, "categoryTop", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'type', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'position', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'enabled', type: () => Boolean, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 })),
    __param(5, (0, graphql_1.Args)({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, Boolean, Number, Number]),
    __metadata("design:returntype", Promise)
], OperationsAdminResolver.prototype, "contentItems", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], OperationsAdminResolver.prototype, "contentItem", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], OperationsAdminResolver.prototype, "createContentItem", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], OperationsAdminResolver.prototype, "updateContentItem", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], OperationsAdminResolver.prototype, "deleteContentItem", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.OperationsPermissions.ManageContent),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], OperationsAdminResolver.prototype, "triggerContentLifecycle", null);
exports.OperationsAdminResolver = OperationsAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [operations_dashboard_service_1.OperationsDashboardService,
        content_service_1.ContentService])
], OperationsAdminResolver);
