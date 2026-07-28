import { RequestContext, TransactionalConnection } from '@vendure/core';
export type DashboardRange = 'today' | 'yesterday' | 'week' | 'month';
export declare class OperationsDashboardService {
    private connection;
    constructor(connection: TransactionalConnection);
    private getRange;
    private getDaysAgoStart;
    getSalesMetrics(ctx: RequestContext, range: DashboardRange): Promise<{
        orderCount: number;
        gmv: number;
        previousOrderCount: number;
        previousGmv: number;
        pendingCount: number;
    }>;
    getDeliveryMetrics(ctx: RequestContext, range: DashboardRange): Promise<{
        pending: number;
        inProgress: number;
        delivered: number;
        exception: number;
    }>;
    getCustomerMetrics(ctx: RequestContext, range: DashboardRange): Promise<{
        newCount: number;
        totalCount: number;
        levelDistribution: {
            levelId: any;
            levelName: null;
            count: number;
        }[];
    }>;
    getInventoryMetrics(ctx: RequestContext): Promise<{
        lowStockCount: number;
        pendingStockIn: number;
        pendingStockOut: number;
        pendingStockMove: number;
        pendingStocktake: number;
    }>;
    getAfterSalesMetrics(ctx: RequestContext, range: DashboardRange): Promise<{
        pendingCount: number;
        exceptionOrderCount: number;
    }>;
    getMarketingMetrics(ctx: RequestContext): Promise<{
        activeFlashSaleCount: number;
        activeGroupBuyCount: number;
        couponClaimedCount: number;
    }>;
    getSalesTrend(ctx: RequestContext, days: 7 | 30): Promise<{
        date: any;
        orderCount: number;
        gmv: number;
    }[]>;
    getCategoryTop(ctx: RequestContext, days: 7 | 30): Promise<{
        categoryId: any;
        categoryName: any;
        gmv: number;
        orderCount: number;
    }[]>;
    getDashboardOverview(ctx: RequestContext, range: DashboardRange): Promise<{
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
}
