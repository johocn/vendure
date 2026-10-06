import { RequestContext, TransactionalConnection } from '@vendure/core';
export type DashboardRange = 'today' | 'yesterday' | 'week' | 'month';
export declare class OperationsDashboardService {
    private connection;
    constructor(connection: TransactionalConnection);
    private getRange;
    private getDaysAgoStart;
    /**
     * 解析 customFields 子字段的物理列名（embedded 列名随 TypeORM 命名策略生成，
     * 如 deliveryStatus → customFieldsDeliverystatus，无下划线，不能硬编码）。
     * 字段未注册（对应插件未启用）时返回 null，调用方应优雅降级。
     */
    private cfColumnName;
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
    /** 有效订单状态集合（与 getSalesMetrics 口径一致） */
    private static readonly VALID_ORDER_STATUSES;
    /** 复购率（0-100，一位小数）：窗口内有效下单客户中 ≥2 单客户的占比 */
    getRepurchaseRate(ctx: RequestContext, days: number): Promise<number>;
    /** 评价概览（渠道内主评）：均分/差评率(rating≤2)/待审数/带图率 */
    getReviewOverview(ctx: RequestContext): Promise<{
        totalApproved: number;
        avgRating: number;
        badRate: number;
        pendingCount: number;
        withImagesRate: number;
    }>;
    /** 热销商品榜：窗口内有效订单按件数排序，amount 为分（listPrice*qty，与 gmv 口径一致） */
    getProductSalesTop(ctx: RequestContext, days: number, take?: number): Promise<{
        productId: any;
        name: any;
        quantity: number;
        amount: number;
    }[]>;
    /** 骑手效率榜：窗口内 deliveryStatus=delivered 的订单按骑手聚合；准时率基于承诺时段（deliverySlotText）结束时刻 */
    getRiderEfficiency(ctx: RequestContext, days: number, take?: number): Promise<{
        customerId: string;
        name: any;
        completed: number;
        onTimeRate: number;
    }[]>;
    /** 解析承诺时段文案的结束时刻：'2026-10-06 11:00-11:30' → 当日 11:30 */
    private slotEndTime;
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
