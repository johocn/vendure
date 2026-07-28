import { ID, RequestContext } from '@vendure/core';
import { ContentService } from './content.service';
import { OperationsDashboardService } from './operations-dashboard.service';
/**
 * @description
 * Operations Admin API Resolver (schema-first mode).
 *
 * Permission mapping:
 * - dashboardOverview / salesTrend / categoryTop → ViewDashboard (@Allow)
 * - contentItems / contentItem → dynamic by type (manual auth)
 * - createContentItem / updateContentItem / deleteContentItem → dynamic by type (manual auth)
 */
export declare class OperationsAdminResolver {
    private dashboardService;
    private contentService;
    constructor(dashboardService: OperationsDashboardService, contentService: ContentService);
    dashboardOverview(ctx: RequestContext, range: string): Promise<{
        sales: {
            orderCount: number;
            gmv: number;
            previousOrderCount: number;
            previousGmv: number;
            pendingCount: number;
        } | null;
        delivery: {
            pending: number;
            inProgress: number;
            delivered: number;
            exception: number;
        } | null;
        customer: {
            newCount: number;
            totalCount: number;
            levelDistribution: {
                levelId: any;
                levelName: null;
                count: number;
            }[];
        } | null;
        inventory: {
            lowStockCount: number;
            pendingStockIn: number;
            pendingStockOut: number;
            pendingStockMove: number;
            pendingStocktake: number;
        } | null;
        afterSales: {
            pendingCount: number;
            exceptionOrderCount: number;
        } | null;
        marketing: {
            activeFlashSaleCount: number;
            activeGroupBuyCount: number;
            couponClaimedCount: number;
        } | null;
    }>;
    salesTrend(ctx: RequestContext, days: number): Promise<{
        date: any;
        orderCount: number;
        gmv: number;
    }[]>;
    categoryTop(ctx: RequestContext, days: number): Promise<{
        categoryId: any;
        categoryName: any;
        gmv: number;
        orderCount: number;
    }[]>;
    contentItems(ctx: RequestContext, type?: string, position?: string, enabled?: boolean, page?: number, pageSize?: number): Promise<{
        items: import(".").ContentItem[];
        totalItems: number;
    }>;
    contentItem(ctx: RequestContext, id: ID): Promise<import(".").ContentItem | null>;
    createContentItem(ctx: RequestContext, input: any): Promise<import(".").ContentItem>;
    updateContentItem(ctx: RequestContext, id: ID, input: any): Promise<import(".").ContentItem>;
    deleteContentItem(ctx: RequestContext, id: ID): Promise<boolean>;
    triggerContentLifecycle(ctx: RequestContext): Promise<{
        published: number;
        unpublished: number;
    }>;
    private assertContentPermission;
    private getPermissionByType;
}
