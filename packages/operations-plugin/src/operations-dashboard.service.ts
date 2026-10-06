// e:\code\vendure\packages\operations-plugin\src\operations-dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection } from '@vendure/core';

import { LOW_STOCK_THRESHOLD } from './constants';

export type DashboardRange = 'today' | 'yesterday' | 'week' | 'month';

interface RangeResult {
    start: Date;
    end: Date;
    prevStart: Date;
    prevEnd: Date;
}

@Injectable()
export class OperationsDashboardService {
    constructor(private connection: TransactionalConnection) {}

    // ===== Range helpers =====

    private getRange(range: DashboardRange): RangeResult {
        const now = new Date();
        let start: Date;
        let end: Date = new Date(now);
        let prevStart: Date;
        let prevEnd: Date;

        switch (range) {
            case 'today': {
                start = new Date(now);
                start.setHours(0, 0, 0, 0);
                prevStart = new Date(start);
                prevStart.setDate(prevStart.getDate() - 1);
                prevEnd = new Date(start);
                break;
            }
            case 'yesterday': {
                start = new Date(now);
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
                prevStart = new Date(start);
                prevStart.setDate(prevStart.getDate() - 1);
                prevEnd = new Date(start);
                break;
            }
            case 'week': {
                start = new Date(now);
                const dayOfWeek = start.getDay() || 7; // Monday=1, Sunday=7
                start.setDate(start.getDate() - dayOfWeek + 1);
                start.setHours(0, 0, 0, 0);
                prevStart = new Date(start);
                prevStart.setDate(prevStart.getDate() - 7);
                prevEnd = new Date(start);
                break;
            }
            case 'month': {
                start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
                prevEnd = new Date(start);
                break;
            }
            default: {
                start = new Date(now);
                start.setHours(0, 0, 0, 0);
                prevStart = new Date(start);
                prevStart.setDate(prevStart.getDate() - 1);
                prevEnd = new Date(start);
            }
        }
        return { start, end, prevStart, prevEnd };
    }

    private getDaysAgoStart(days: number): Date {
        const d = new Date();
        d.setDate(d.getDate() - days);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // ===== 6 metric cards =====

    async getSalesMetrics(ctx: RequestContext, range: DashboardRange) {
        const { start, end, prevStart, prevEnd } = this.getRange(range);
        const orderRepo = this.connection.getRepository(ctx, 'Order' as any);

        // Current period: valid orders (Paid, Shipped, Delivered, PartiallyShipped)
        // Note: order.totalWithTax is a @Calculated getter, not a physical column.
        // Use order.subTotalWithTax + order.shippingWithTax instead.
        const validStatuses = ['Paid', 'Shipped', 'Delivered', 'PartiallyShipped'];
        const current = await orderRepo
            .createQueryBuilder('order')
            .select('COUNT(order.id)', 'orderCount')
            .addSelect('COALESCE(SUM(order.subTotalWithTax + order.shippingWithTax), 0)', 'gmv')
            .where('order.createdAt BETWEEN :start AND :end', { start, end })
            .andWhere('order.state IN (:...statuses)', { statuses: validStatuses })
            .getRawOne();

        const previous = await orderRepo
            .createQueryBuilder('order')
            .select('COUNT(order.id)', 'orderCount')
            .addSelect('COALESCE(SUM(order.subTotalWithTax + order.shippingWithTax), 0)', 'gmv')
            .where('order.createdAt BETWEEN :start AND :end', { start: prevStart, end: prevEnd })
            .andWhere('order.state IN (:...statuses)', { statuses: validStatuses })
            .getRawOne();

        const pendingCount = await orderRepo
            .createQueryBuilder('order')
            .where('order.createdAt BETWEEN :start AND :end', { start, end })
            .andWhere('order.state IN (:...pending)', { pending: ['AddingItems', 'ArrangingPayment'] })
            .getCount();

        return {
            orderCount: Number(current?.orderCount ?? 0),
            gmv: Number(current?.gmv ?? 0),
            previousOrderCount: Number(previous?.orderCount ?? 0),
            previousGmv: Number(previous?.gmv ?? 0),
            pendingCount,
        };
    }

    async getDeliveryMetrics(ctx: RequestContext, range: DashboardRange) {
        const { start, end } = this.getRange(range);
        const orderRepo = this.connection.getRepository(ctx, 'Order' as any);

        // Group by customFields.deliveryStatus
        // Vendure customFields 是 embedded 子列（customFields_deliveryStatus），不是实体真实属性：
        // TypeORM 不会对 `order.customFields_xxx` 加引号转义，而 order 是 PG 保留字，
        // 必须整路径手写引号 `"order"."customFields_xxx"`，否则报 syntax error at or near "."
        const rows = await orderRepo
            .createQueryBuilder('order')
            .select('"order"."customFields_deliveryStatus"', 'status')
            .addSelect('COUNT(order.id)', 'count')
            .where('order.createdAt BETWEEN :start AND :end', { start, end })
            .andWhere('"order"."customFields_deliveryStatus" IS NOT NULL')
            .groupBy('"order"."customFields_deliveryStatus"')
            .getRawMany();

        const map: Record<string, number> = {};
        for (const r of rows) {
            map[r.status] = Number(r.count);
        }

        return {
            pending: map['assigned'] ?? map['pending'] ?? 0,
            inProgress: map['in_progress'] ?? map['delivering'] ?? 0,
            delivered: map['delivered'] ?? 0,
            exception: map['exception'] ?? 0,
        };
    }

    async getCustomerMetrics(ctx: RequestContext, range: DashboardRange) {
        const { start, end } = this.getRange(range);
        const customerRepo = this.connection.getRepository(ctx, 'Customer' as any);

        const newCount = await customerRepo
            .createQueryBuilder('customer')
            .where('customer.createdAt BETWEEN :start AND :end', { start, end })
            .getCount();

        const totalCount = await customerRepo.createQueryBuilder('customer').getCount();

        // Level distribution (depends on member-level-plugin customFields.memberLevelId)
        const levelRows = await customerRepo
            .createQueryBuilder('customer')
            .select('"customer"."customFields_memberLevelId"', 'levelId')
            .addSelect('COUNT(customer.id)', 'count')
            .where('"customer"."customFields_memberLevelId" IS NOT NULL')
            .groupBy('"customer"."customFields_memberLevelId"')
            .getRawMany();

        const levelDistribution = levelRows.map(r => ({
            levelId: r.levelId,
            levelName: null, // Resolved by frontend or via separate query
            count: Number(r.count),
        }));

        return { newCount, totalCount, levelDistribution };
    }

    async getInventoryMetrics(ctx: RequestContext) {
        // Low stock count
        const stockLevelRepo = this.connection.getRepository(ctx, 'StockLevel' as any);
        let lowStockCount = 0;
        try {
            lowStockCount = await stockLevelRepo
                .createQueryBuilder('stock')
                .where('stock.stockOnHand <= :threshold', { threshold: LOW_STOCK_THRESHOLD })
                .getCount();
        } catch (e: any) {
            Logger.warn(`Low stock query failed: ${e.message}`, 'OperationsDashboard');
        }

        // Pending inventory orders (inventory-plugin entities)
        let pendingStockIn = 0, pendingStockOut = 0, pendingStockMove = 0, pendingStocktake = 0;
        try {
            const stockInRepo = this.connection.getRepository(ctx, 'StockInOrder' as any);
            pendingStockIn = await stockInRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        } catch (e) { /* inventory-plugin not enabled */ }
        try {
            const stockOutRepo = this.connection.getRepository(ctx, 'StockOutOrder' as any);
            pendingStockOut = await stockOutRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        } catch (e) { /* inventory-plugin not enabled */ }
        try {
            const stockMoveRepo = this.connection.getRepository(ctx, 'StockMoveOrder' as any);
            pendingStockMove = await stockMoveRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        } catch (e) { /* inventory-plugin not enabled */ }
        try {
            const stocktakeRepo = this.connection.getRepository(ctx, 'StocktakeOrder' as any);
            pendingStocktake = await stocktakeRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        } catch (e) { /* inventory-plugin not enabled */ }

        return { lowStockCount, pendingStockIn, pendingStockOut, pendingStockMove, pendingStocktake };
    }

    async getAfterSalesMetrics(ctx: RequestContext, range: DashboardRange) {
        const { start, end } = this.getRange(range);
        let pendingCount = 0;
        let exceptionOrderCount = 0;

        try {
            const asRepo = this.connection.getRepository(ctx, 'AfterSalesRequest' as any);
            pendingCount = await asRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        } catch (e: any) {
            Logger.warn(`AfterSales query failed: ${e.message}`, 'OperationsDashboard');
        }

        try {
            const orderRepo = this.connection.getRepository(ctx, 'Order' as any);
            exceptionOrderCount = await orderRepo
                .createQueryBuilder('order')
                .where('order.createdAt BETWEEN :start AND :end', { start, end })
                .andWhere('"order"."customFields_deliveryStatus" = :status', { status: 'exception' })
                .getCount();
        } catch (e: any) {
            Logger.warn(`Exception order query failed: ${e.message}`, 'OperationsDashboard');
        }

        return { pendingCount, exceptionOrderCount };
    }

    async getMarketingMetrics(ctx: RequestContext) {
        let activeFlashSaleCount = 0, activeGroupBuyCount = 0, couponClaimedCount = 0;

        const now = new Date();
        try {
            const fsRepo = this.connection.getRepository(ctx, 'FlashSaleActivity' as any);
            activeFlashSaleCount = await fsRepo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'active' })
                .andWhere('e.startAt <= :now', { now })
                .andWhere('e.endAt >= :now', { now })
                .getCount();
        } catch (e: any) {
            Logger.warn(`FlashSale query failed: ${e.message}`, 'OperationsDashboard');
        }

        try {
            const gbRepo = this.connection.getRepository(ctx, 'GroupBuyActivity' as any);
            activeGroupBuyCount = await gbRepo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'active' })
                .andWhere('e.startAt <= :now', { now })
                .andWhere('e.endAt >= :now', { now })
                .getCount();
        } catch (e: any) {
            Logger.warn(`GroupBuy query failed: ${e.message}`, 'OperationsDashboard');
        }

        try {
            const ccRepo = this.connection.getRepository(ctx, 'CouponCode' as any);
            couponClaimedCount = await ccRepo
                .createQueryBuilder('e')
                .where('e.claimedAt IS NOT NULL')
                .getCount();
        } catch (e: any) {
            Logger.warn(`Coupon query failed: ${e.message}`, 'OperationsDashboard');
        }

        return { activeFlashSaleCount, activeGroupBuyCount, couponClaimedCount };
    }

    // ===== Trend charts =====

    async getSalesTrend(ctx: RequestContext, days: 7 | 30) {
        const start = this.getDaysAgoStart(days);
        const end = new Date();
        const orderRepo = this.connection.getRepository(ctx, 'Order' as any);

        // Note: order.totalWithTax is a @Calculated getter, not a physical column.
        // Use order.subTotalWithTax + order.shippingWithTax instead.
        const validStatuses = ['Paid', 'Shipped', 'Delivered', 'PartiallyShipped'];
        const rows = await orderRepo
            .createQueryBuilder('order')
            .select("DATE(order.createdAt)", 'date')
            .addSelect('COUNT(order.id)', 'orderCount')
            .addSelect('COALESCE(SUM(order.subTotalWithTax + order.shippingWithTax), 0)', 'gmv')
            .where('order.createdAt BETWEEN :start AND :end', { start, end })
            .andWhere('order.state IN (:...statuses)', { statuses: validStatuses })
            .groupBy('date')
            .orderBy('date', 'ASC')
            .getRawMany();

        return rows.map(r => ({
            date: r.date,
            orderCount: Number(r.orderCount),
            gmv: Number(r.gmv),
        }));
    }

    async getCategoryTop(ctx: RequestContext, days: 7 | 30) {
        const start = this.getDaysAgoStart(days);
        const end = new Date();
        const orderRepo = this.connection.getRepository(ctx, 'Order' as any);

        // Note: line.linePriceWithTax is a @Calculated getter, not a physical column.
        // Use line.listPrice * line.quantity as a close approximation (listPrice usually
        // includes tax for B2C channels; taxRate is also @Calculated so cannot be used in SQL).
        //
        // Path: order.lines -> productVariant -> collections (Collection)
        // Product entity has NO `categories` relation; collections are linked via ProductVariant.collections.
        // Collection.name is a LocaleString resolved from CollectionTranslation (not a physical column),
        // so we left-join translations and pick the best available language.
        const validStatuses = ['Paid', 'Shipped', 'Delivered', 'PartiallyShipped'];
        const rows = await orderRepo
            .createQueryBuilder('order')
            .innerJoin('order.lines', 'line')
            .innerJoin('line.productVariant', 'variant')
            .innerJoin('variant.collections', 'collection')
            .leftJoin(
                'collection.translations',
                'ct',
                'ct.languageCode IN (:...langs)',
                { langs: ['zh', 'zh_CN', 'en', 'en_US'] },
            )
            .select('collection.id', 'categoryId')
            .addSelect('MAX(ct.name)', 'categoryName')
            .addSelect('COALESCE(SUM(line.listPrice * line.quantity), 0)', 'gmv')
            .addSelect('COUNT(DISTINCT order.id)', 'orderCount')
            .where('order.createdAt BETWEEN :start AND :end', { start, end })
            .andWhere('order.state IN (:...statuses)', { statuses: validStatuses })
            .groupBy('collection.id')
            .orderBy('gmv', 'DESC')
            .limit(10)
            .getRawMany();

        return rows.map(r => ({
            categoryId: r.categoryId,
            categoryName: r.categoryName ?? `Collection ${r.categoryId}`,
            gmv: Number(r.gmv),
            orderCount: Number(r.orderCount),
        }));
    }

    // ===== Growth-loop aggregates（四期：复购/评价/热销/骑手效率） =====

    /** 有效订单状态集合（与 getSalesMetrics 口径一致） */
    private static readonly VALID_ORDER_STATUSES = ['Paid', 'Shipped', 'Delivered', 'PartiallyShipped'];

    /** 复购率（0-100，一位小数）：窗口内有效下单客户中 ≥2 单客户的占比 */
    async getRepurchaseRate(ctx: RequestContext, days: number) {
        const start = this.getDaysAgoStart(days);
        const orderRepo = this.connection.getRepository(ctx, 'Order' as any);
        const rows = await orderRepo
            .createQueryBuilder('order')
            .select('order.customerId', 'customerId')
            .addSelect('COUNT(order.id)', 'cnt')
            .where('order.createdAt >= :start', { start })
            .andWhere('order.state IN (:...statuses)', { statuses: OperationsDashboardService.VALID_ORDER_STATUSES })
            .groupBy('order.customerId')
            .getRawMany();
        const total = rows.length;
        if (!total) return 0;
        const repeat = rows.filter(r => Number(r.cnt) >= 2).length;
        return Math.round((repeat / total) * 1000) / 10;
    }

    /** 评价概览（渠道内主评）：均分/差评率(rating≤2)/待审数/带图率 */
    async getReviewOverview(ctx: RequestContext) {
        const reviewRepo = this.connection.getRepository(ctx, 'Review' as any);
        const agg = await reviewRepo
            .createQueryBuilder('review')
            .select('COUNT(review.id)', 'total')
            .addSelect('COALESCE(AVG(review.rating), 0)', 'avgRating')
            .addSelect('COALESCE(SUM(CASE WHEN review.rating <= 2 THEN 1 ELSE 0 END), 0)', 'bad')
            .addSelect("COALESCE(SUM(CASE WHEN review.images IS NOT NULL AND review.images != '[]' THEN 1 ELSE 0 END), 0)", 'withImages')
            .where('review.status = :status', { status: 'approved' })
            .andWhere('review.parentId IS NULL')
            .getRawOne();
        const pendingCount = await reviewRepo
            .createQueryBuilder('review')
            .where('review.status = :status', { status: 'pending' })
            .andWhere('review.parentId IS NULL')
            .getCount();
        const total = Number(agg?.total ?? 0);
        const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
        return {
            totalApproved: total,
            avgRating: Math.round(Number(agg?.avgRating ?? 0) * 10) / 10,
            badRate: pct(Number(agg?.bad ?? 0)),
            pendingCount,
            withImagesRate: pct(Number(agg?.withImages ?? 0)),
        };
    }

    /** 热销商品榜：窗口内有效订单按件数排序，amount 为分（listPrice*qty，与 gmv 口径一致） */
    async getProductSalesTop(ctx: RequestContext, days: number, take = 5) {
        const start = this.getDaysAgoStart(days);
        const orderRepo = this.connection.getRepository(ctx, 'Order' as any);
        const rows = await orderRepo
            .createQueryBuilder('order')
            .innerJoin('order.lines', 'line')
            .innerJoin('line.productVariant', 'variant')
            .innerJoin('variant.product', 'product')
            .leftJoin('product.translations', 'pt', 'pt.languageCode IN (:...langs)', { langs: ['zh', 'zh_CN', 'en', 'en_US'] })
            .select('product.id', 'productId')
            .addSelect('MAX(pt.name)', 'name')
            .addSelect('COALESCE(SUM(line.quantity), 0)', 'quantity')
            .addSelect('COALESCE(SUM(line.listPrice * line.quantity), 0)', 'amount')
            .where('order.createdAt >= :start', { start })
            .andWhere('order.state IN (:...statuses)', { statuses: OperationsDashboardService.VALID_ORDER_STATUSES })
            .groupBy('product.id')
            .orderBy('quantity', 'DESC')
            .limit(take)
            .getRawMany();
        return rows.map(r => ({
            productId: r.productId,
            name: r.name ?? `Product ${r.productId}`,
            quantity: Number(r.quantity),
            amount: Number(r.amount),
        }));
    }

    /** 骑手效率榜：窗口内 deliveryStatus=delivered 的订单按骑手聚合；准时率基于承诺时段（deliverySlotText）结束时刻 */
    async getRiderEfficiency(ctx: RequestContext, days: number, take = 5) {
        const start = this.getDaysAgoStart(days);
        const orderRepo = this.connection.getRepository(ctx, 'Order' as any);
        const rows = await orderRepo
            .createQueryBuilder('order')
            .select('"order"."customFields_deliveryStaffId"', 'riderId')
            .addSelect('"order"."customFields_deliverySlotText"', 'slotText')
            .addSelect('"order"."customFields_deliveredAt"', 'deliveredAt')
            .where('order.createdAt >= :start', { start })
            .andWhere('"order"."customFields_deliveryStatus" = :status', { status: 'delivered' })
            .andWhere('"order"."customFields_deliveryStaffId" IS NOT NULL')
            .getRawMany();

        // JS 聚合：completed = 送达单数；onTime = 有承诺时段且 deliveredAt ≤ 时段结束
        const stat = new Map<string, { completed: number; slotted: number; onTime: number }>();
        for (const r of rows) {
            const key = String(r.riderId);
            const s = stat.get(key) ?? { completed: 0, slotted: 0, onTime: 0 };
            s.completed += 1;
            const end = this.slotEndTime(r.slotText);
            if (end) {
                s.slotted += 1;
                const delivered = r.deliveredAt ? new Date(r.deliveredAt) : null;
                if (delivered && delivered <= end) s.onTime += 1;
            }
            stat.set(key, s);
        }
        if (!stat.size) return [];

        // 骑手姓名解析（Customer.firstName/lastName，与 merchant-admin.service 同款）
        const riderIds = [...stat.keys()];
        const customerRepo = this.connection.getRepository(ctx, 'Customer' as any);
        const customers = await customerRepo.findByIds(riderIds);
        const nameById = new Map(customers.map(c => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.email]));

        return [...stat.entries()]
            .map(([id, s]) => ({
                customerId: id,
                name: nameById.get(id) ?? `骑手 ${id}`,
                completed: s.completed,
                onTimeRate: s.slotted ? Math.round((s.onTime / s.slotted) * 1000) / 10 : 100,
            }))
            .sort((a, b) => b.completed - a.completed)
            .slice(0, take);
    }

    /** 解析承诺时段文案的结束时刻：'2026-10-06 11:00-11:30' → 当日 11:30 */
    private slotEndTime(text: string | null): Date | null {
        if (!text) return null;
        const m = text.match(/(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}-(\d{2}:\d{2})/);
        if (!m) return null;
        const d = new Date(`${m[1].replace(/-/g, '/')} ${m[2]}`);
        return isNaN(d.getTime()) ? null : d;
    }

    // ===== Dashboard aggregation entry (fault-tolerant) =====

    async getDashboardOverview(ctx: RequestContext, range: DashboardRange) {
        const safeRun = async <T>(fn: () => Promise<T>, key: string): Promise<T | null> => {
            try {
                return await fn();
            } catch (e: any) {
                Logger.warn(`Dashboard ${key} failed: ${e.message}`, 'OperationsDashboard');
                return null;
            }
        };

        const [sales, delivery, customer, inventory, afterSales, marketing] = await Promise.all([
            safeRun(() => this.getSalesMetrics(ctx, range), 'sales'),
            safeRun(() => this.getDeliveryMetrics(ctx, range), 'delivery'),
            safeRun(() => this.getCustomerMetrics(ctx, range), 'customer'),
            safeRun(() => this.getInventoryMetrics(ctx), 'inventory'),
            safeRun(() => this.getAfterSalesMetrics(ctx, range), 'afterSales'),
            safeRun(() => this.getMarketingMetrics(ctx), 'marketing'),
        ]);

        return { sales, delivery, customer, inventory, afterSales, marketing };
    }
}
