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
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const date_fns_1 = require("date-fns");
const node_crypto_1 = require("node:crypto");
const metrics_strategies_js_1 = require("../config/metrics-strategies.js");
const constants_js_1 = require("../constants.js");
let MetricsService = class MetricsService {
    constructor(connection, cacheService) {
        this.connection = connection;
        this.cacheService = cacheService;
        this.metricCalculations = [
            new metrics_strategies_js_1.AverageOrderValueMetric(),
            new metrics_strategies_js_1.OrderCountMetric(),
            new metrics_strategies_js_1.OrderTotalMetric(),
        ];
    }
    async getMetrics(ctx, { types, refresh, startDate, endDate }) {
        const calculatedStartDate = (0, date_fns_1.startOfDay)(new Date(startDate));
        const calculatedEndDate = (0, date_fns_1.endOfDay)(new Date(endDate));
        // Check if we have cached result
        const hash = (0, node_crypto_1.createHash)('sha1')
            .update(JSON.stringify({
            startDate: calculatedStartDate,
            endDate: calculatedEndDate,
            types: [...types].sort(),
            channel: ctx.channel.token,
        }))
            .digest('base64');
        const cacheKey = `MetricsService:${hash}`;
        const cachedMetricList = await this.cacheService.get(cacheKey);
        if (cachedMetricList && refresh !== true) {
            core_1.Logger.verbose(`Returning cached metrics for channel ${ctx.channel.token}`, constants_js_1.loggerCtx);
            return cachedMetricList;
        }
        // No cache, calculating new metrics
        core_1.Logger.verbose(`No cache hit, calculating metrics from ${calculatedStartDate.toISOString()} to ${calculatedEndDate.toISOString()} for channel ${ctx.channel.token} for all orders`, constants_js_1.loggerCtx);
        const data = await this.loadData(ctx, calculatedStartDate, calculatedEndDate);
        const metrics = [];
        for (const type of types) {
            const metric = this.metricCalculations.find(m => m.type === type);
            if (!metric) {
                continue;
            }
            // Calculate entries for each day
            const entries = [];
            data.forEach(dataPerDay => {
                entries.push(metric.calculateEntry(ctx, dataPerDay));
            });
            // Create metric with calculated entries
            metrics.push({
                title: metric.getTitle(ctx),
                type: metric.type,
                entries,
            });
        }
        await this.cacheService.set(cacheKey, metrics, { ttl: 1000 * 60 * 60 * 2 }); // 2 hours
        return metrics;
    }
    async loadData(ctx, startDate, endDate) {
        const orderRepo = this.connection.getRepository(ctx, core_1.Order);
        // Calculate number of days between start and end
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const nrOfDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        // Get orders in a loop until we have all
        let skip = 0;
        const take = 1000;
        let hasMoreOrders = true;
        const orders = [];
        while (hasMoreOrders) {
            const query = orderRepo
                .createQueryBuilder('order')
                .leftJoin('order.channels', 'orderChannel')
                .where('orderChannel.id=:channelId', { channelId: ctx.channelId })
                .andWhere('order.orderPlacedAt >= :startDate', {
                startDate: startDate.toISOString(),
            })
                .andWhere('order.orderPlacedAt <= :endDate', {
                endDate: endDate.toISOString(),
            })
                .skip(skip)
                .take(take);
            const [items, nrOfOrders] = await query.getManyAndCount();
            orders.push(...items);
            core_1.Logger.verbose(`Fetched orders ${skip}-${skip + take} for channel ${ctx.channel.token} for date range metrics`, constants_js_1.loggerCtx);
            skip += items.length;
            if (orders.length >= nrOfOrders) {
                hasMoreOrders = false;
            }
        }
        core_1.Logger.verbose(`Finished fetching all ${orders.length} orders for channel ${ctx.channel.token} for date range metrics`, constants_js_1.loggerCtx);
        const dataPerDay = new Map();
        // Create a map entry for each day in the range
        for (let i = 0; i < nrOfDays; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateKey = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
            // Filter orders for this specific day
            const ordersForDay = orders.filter(order => {
                if (!order.orderPlacedAt)
                    return false;
                const orderDate = new Date(order.orderPlacedAt).toISOString().split('T')[0];
                return orderDate === dateKey;
            });
            dataPerDay.set(dateKey, {
                orders: ordersForDay,
                date: currentDate,
            });
        }
        return dataPerDay;
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CacheService])
], MetricsService);
