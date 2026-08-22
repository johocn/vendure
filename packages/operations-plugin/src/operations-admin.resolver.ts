// e:\code\vendure\packages\operations-plugin\src\operations-admin.resolver.ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ForbiddenError, ID, Permission, RequestContext } from '@vendure/core';

import { OperationsPermissions } from './constants';
import { ContentService } from './content.service';
import { OperationsDashboardService, DashboardRange } from './operations-dashboard.service';

/**
 * @description
 * Operations Admin API Resolver (schema-first mode).
 *
 * Permission mapping:
 * - dashboardOverview / salesTrend / categoryTop → ViewDashboard (@Allow)
 * - contentItems / contentItem → dynamic by type (manual auth)
 * - createContentItem / updateContentItem / deleteContentItem → dynamic by type (manual auth)
 */
@Resolver()
export class OperationsAdminResolver {
    constructor(
        private dashboardService: OperationsDashboardService,
        private contentService: ContentService,
    ) {}

    // ===== Dashboard =====

    @Query()
    @Allow(OperationsPermissions.ViewDashboard as Permission)
    async dashboardOverview(
        @Ctx() ctx: RequestContext,
        @Args('range') range: string,
    ) {
        const validRanges: DashboardRange[] = ['today', 'yesterday', 'week', 'month'];
        if (!validRanges.includes(range as DashboardRange)) {
            throw new Error(`Invalid range: must be one of ${validRanges.join('/')}`);
        }
        return this.dashboardService.getDashboardOverview(ctx, range as DashboardRange);
    }

    @Query()
    @Allow(OperationsPermissions.ViewDashboard as Permission)
    async salesTrend(
        @Ctx() ctx: RequestContext,
        @Args('days') days: number,
    ) {
        const validDays = [7, 30] as const;
        if (!validDays.includes(days as any)) {
            throw new Error('days must be 7 or 30');
        }
        return this.dashboardService.getSalesTrend(ctx, days as 7 | 30);
    }

    @Query()
    @Allow(OperationsPermissions.ViewDashboard as Permission)
    async categoryTop(
        @Ctx() ctx: RequestContext,
        @Args('days') days: number,
    ) {
        const validDays = [7, 30] as const;
        if (!validDays.includes(days as any)) {
            throw new Error('days must be 7 or 30');
        }
        return this.dashboardService.getCategoryTop(ctx, days as 7 | 30);
    }

    // ===== CMS (dynamic permission by type) =====

    @Query()
    async contentItems(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'type', type: () => String, nullable: true }) type?: string,
        @Args({ name: 'position', type: () => String, nullable: true }) position?: string,
        @Args({ name: 'enabled', type: () => Boolean, nullable: true }) enabled?: boolean,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        this.assertContentPermission(ctx, type);
        return this.contentService.findContentItems(ctx, { type, position, enabled, page, pageSize });
    }

    @Query()
    async contentItem(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        // Permission checked after fetching item (need to know type)
        const item = await this.contentService.findOneContentItem(ctx, id);
        if (!item) return null;
        this.assertContentPermission(ctx, item.type);
        return item;
    }

    @Mutation()
    async createContentItem(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ) {
        this.assertContentPermission(ctx, input.type);
        return this.contentService.createContentItem(ctx, input);
    }

    @Mutation()
    async updateContentItem(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ) {
        // Permission checked after fetching item (need to know type)
        const item = await this.contentService.findOneContentItem(ctx, id);
        if (!item) {
            throw new Error('Content item not found');
        }
        this.assertContentPermission(ctx, item.type);
        return this.contentService.updateContentItem(ctx, id, input);
    }

    @Mutation()
    async deleteContentItem(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        const item = await this.contentService.findOneContentItem(ctx, id);
        if (!item) {
            throw new Error('Content item not found');
        }
        this.assertContentPermission(ctx, item.type);
        return this.contentService.deleteContentItem(ctx, id);
    }

    // ===== Manual lifecycle trigger (admin/testing) =====

    @Mutation()
    @Allow(OperationsPermissions.ManageContent as Permission)
    async triggerContentLifecycle(
        @Ctx() ctx: RequestContext,
    ) {
        return this.contentService.runLifecycleCheck(ctx);
    }

    // ===== Dynamic permission check =====

    private assertContentPermission(ctx: RequestContext, type?: string): void {
        const requiredPerm = this.getPermissionByType(type);
        if (!ctx.userHasPermissions([requiredPerm])) {
            throw new ForbiddenError();
        }
    }

    private getPermissionByType(type?: string): Permission {
        switch (type) {
            case 'Banner':
                return OperationsPermissions.ManageBanner as Permission;
            case 'Recommendation':
                return OperationsPermissions.ManageRecommendation as Permission;
            case 'Notice':
                return OperationsPermissions.ManageNotice as Permission;
            case 'Floor':
                return OperationsPermissions.ManageFloor as Permission;
            case 'IconGrid':
                return OperationsPermissions.ManageContent as Permission;
            case 'CategoryNav':
                return OperationsPermissions.ManageContent as Permission;
            default:
                return OperationsPermissions.ManageContent as Permission;
        }
    }
}
