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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationsDashboardService = void 0;
// e:\code\vendure\packages\operations-plugin\src\operations-dashboard.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
let OperationsDashboardService = class OperationsDashboardService {
    constructor(connection) {
        this.connection = connection;
    }
    // ===== Range helpers =====
    getRange(range) {
        const now = new Date();
        let start;
        let end = new Date(now);
        let prevStart;
        let prevEnd;
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
    getDaysAgoStart(days) {
        const d = new Date();
        d.setDate(d.getDate() - days);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    // ===== 6 metric cards =====
    async getSalesMetrics(ctx, range) {
        var _a, _b, _c, _d;
        const { start, end, prevStart, prevEnd } = this.getRange(range);
        const orderRepo = this.connection.getRepository(ctx, 'Order');
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
            orderCount: Number((_a = current === null || current === void 0 ? void 0 : current.orderCount) !== null && _a !== void 0 ? _a : 0),
            gmv: Number((_b = current === null || current === void 0 ? void 0 : current.gmv) !== null && _b !== void 0 ? _b : 0),
            previousOrderCount: Number((_c = previous === null || previous === void 0 ? void 0 : previous.orderCount) !== null && _c !== void 0 ? _c : 0),
            previousGmv: Number((_d = previous === null || previous === void 0 ? void 0 : previous.gmv) !== null && _d !== void 0 ? _d : 0),
            pendingCount,
        };
    }
    async getDeliveryMetrics(ctx, range) {
        var _a, _b, _c, _d, _e, _f;
        const { start, end } = this.getRange(range);
        const orderRepo = this.connection.getRepository(ctx, 'Order');
        // Group by customFields.deliveryStatus
        // Vendure customFields are stored as columns: customFields_deliveryStatus
        const rows = await orderRepo
            .createQueryBuilder('order')
            .select('order.customFields_deliveryStatus', 'status')
            .addSelect('COUNT(order.id)', 'count')
            .where('order.createdAt BETWEEN :start AND :end', { start, end })
            .andWhere('order.customFields_deliveryStatus IS NOT NULL')
            .groupBy('order.customFields_deliveryStatus')
            .getRawMany();
        const map = {};
        for (const r of rows) {
            map[r.status] = Number(r.count);
        }
        return {
            pending: (_b = (_a = map['assigned']) !== null && _a !== void 0 ? _a : map['pending']) !== null && _b !== void 0 ? _b : 0,
            inProgress: (_d = (_c = map['in_progress']) !== null && _c !== void 0 ? _c : map['delivering']) !== null && _d !== void 0 ? _d : 0,
            delivered: (_e = map['delivered']) !== null && _e !== void 0 ? _e : 0,
            exception: (_f = map['exception']) !== null && _f !== void 0 ? _f : 0,
        };
    }
    async getCustomerMetrics(ctx, range) {
        const { start, end } = this.getRange(range);
        const customerRepo = this.connection.getRepository(ctx, 'Customer');
        const newCount = await customerRepo
            .createQueryBuilder('customer')
            .where('customer.createdAt BETWEEN :start AND :end', { start, end })
            .getCount();
        const totalCount = await customerRepo.createQueryBuilder('customer').getCount();
        // Level distribution (depends on member-level-plugin customFields.memberLevelId)
        const levelRows = await customerRepo
            .createQueryBuilder('customer')
            .select('customer.customFields_memberLevelId', 'levelId')
            .addSelect('COUNT(customer.id)', 'count')
            .where('customer.customFields_memberLevelId IS NOT NULL')
            .groupBy('customer.customFields_memberLevelId')
            .getRawMany();
        const levelDistribution = levelRows.map(r => ({
            levelId: r.levelId,
            levelName: null, // Resolved by frontend or via separate query
            count: Number(r.count),
        }));
        return { newCount, totalCount, levelDistribution };
    }
    async getInventoryMetrics(ctx) {
        // Low stock count
        const stockLevelRepo = this.connection.getRepository(ctx, 'StockLevel');
        let lowStockCount = 0;
        try {
            lowStockCount = await stockLevelRepo
                .createQueryBuilder('stock')
                .where('stock.stockOnHand <= :threshold', { threshold: constants_1.LOW_STOCK_THRESHOLD })
                .getCount();
        }
        catch (e) {
            core_1.Logger.warn(`Low stock query failed: ${e.message}`, 'OperationsDashboard');
        }
        // Pending inventory orders (inventory-plugin entities)
        let pendingStockIn = 0, pendingStockOut = 0, pendingStockMove = 0, pendingStocktake = 0;
        try {
            const stockInRepo = this.connection.getRepository(ctx, 'StockInOrder');
            pendingStockIn = await stockInRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        }
        catch (e) { /* inventory-plugin not enabled */ }
        try {
            const stockOutRepo = this.connection.getRepository(ctx, 'StockOutOrder');
            pendingStockOut = await stockOutRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        }
        catch (e) { /* inventory-plugin not enabled */ }
        try {
            const stockMoveRepo = this.connection.getRepository(ctx, 'StockMoveOrder');
            pendingStockMove = await stockMoveRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        }
        catch (e) { /* inventory-plugin not enabled */ }
        try {
            const stocktakeRepo = this.connection.getRepository(ctx, 'StocktakeOrder');
            pendingStocktake = await stocktakeRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        }
        catch (e) { /* inventory-plugin not enabled */ }
        return { lowStockCount, pendingStockIn, pendingStockOut, pendingStockMove, pendingStocktake };
    }
    async getAfterSalesMetrics(ctx, range) {
        const { start, end } = this.getRange(range);
        let pendingCount = 0;
        let exceptionOrderCount = 0;
        try {
            const asRepo = this.connection.getRepository(ctx, 'AfterSalesRequest');
            pendingCount = await asRepo.createQueryBuilder('e').where('e.state = :state', { state: 'Pending' }).getCount();
        }
        catch (e) {
            core_1.Logger.warn(`AfterSales query failed: ${e.message}`, 'OperationsDashboard');
        }
        try {
            const orderRepo = this.connection.getRepository(ctx, 'Order');
            exceptionOrderCount = await orderRepo
                .createQueryBuilder('order')
                .where('order.createdAt BETWEEN :start AND :end', { start, end })
                .andWhere('order.customFields_deliveryStatus = :status', { status: 'exception' })
                .getCount();
        }
        catch (e) {
            core_1.Logger.warn(`Exception order query failed: ${e.message}`, 'OperationsDashboard');
        }
        return { pendingCount, exceptionOrderCount };
    }
    async getMarketingMetrics(ctx) {
        let activeFlashSaleCount = 0, activeGroupBuyCount = 0, couponClaimedCount = 0;
        const now = new Date();
        try {
            const fsRepo = this.connection.getRepository(ctx, 'FlashSaleActivity');
            activeFlashSaleCount = await fsRepo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'active' })
                .andWhere('e.startAt <= :now', { now })
                .andWhere('e.endAt >= :now', { now })
                .getCount();
        }
        catch (e) {
            core_1.Logger.warn(`FlashSale query failed: ${e.message}`, 'OperationsDashboard');
        }
        try {
            const gbRepo = this.connection.getRepository(ctx, 'GroupBuyActivity');
            activeGroupBuyCount = await gbRepo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'active' })
                .andWhere('e.startAt <= :now', { now })
                .andWhere('e.endAt >= :now', { now })
                .getCount();
        }
        catch (e) {
            core_1.Logger.warn(`GroupBuy query failed: ${e.message}`, 'OperationsDashboard');
        }
        try {
            const ccRepo = this.connection.getRepository(ctx, 'CouponCode');
            couponClaimedCount = await ccRepo
                .createQueryBuilder('e')
                .where('e.claimedAt IS NOT NULL')
                .getCount();
        }
        catch (e) {
            core_1.Logger.warn(`Coupon query failed: ${e.message}`, 'OperationsDashboard');
        }
        return { activeFlashSaleCount, activeGroupBuyCount, couponClaimedCount };
    }
    // ===== Trend charts =====
    async getSalesTrend(ctx, days) {
        const start = this.getDaysAgoStart(days);
        const end = new Date();
        const orderRepo = this.connection.getRepository(ctx, 'Order');
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
    async getCategoryTop(ctx, days) {
        const start = this.getDaysAgoStart(days);
        const end = new Date();
        const orderRepo = this.connection.getRepository(ctx, 'Order');
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
            .leftJoin('collection.translations', 'ct', 'ct.languageCode IN (:...langs)', { langs: ['zh', 'zh_CN', 'en', 'en_US'] })
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
        return rows.map(r => {
            var _a;
            return ({
                categoryId: r.categoryId,
                categoryName: (_a = r.categoryName) !== null && _a !== void 0 ? _a : `Collection ${r.categoryId}`,
                gmv: Number(r.gmv),
                orderCount: Number(r.orderCount),
            });
        });
    }
    // ===== Dashboard aggregation entry (fault-tolerant) =====
    async getDashboardOverview(ctx, range) {
        const safeRun = async (fn, key) => {
            try {
                return await fn();
            }
            catch (e) {
                core_1.Logger.warn(`Dashboard ${key} failed: ${e.message}`, 'OperationsDashboard');
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
};
exports.OperationsDashboardService = OperationsDashboardService;
exports.OperationsDashboardService = OperationsDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], OperationsDashboardService);
