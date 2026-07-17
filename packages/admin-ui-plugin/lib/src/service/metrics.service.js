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
const shared_utils_1 = require("@vendure/common/lib/shared-utils");
const core_1 = require("@vendure/core");
const crypto_1 = require("crypto");
const date_fns_1 = require("date-fns");
const metrics_strategies_1 = require("../config/metrics-strategies");
const constants_1 = require("../constants");
const types_1 = require("../types");
let MetricsService = class MetricsService {
    constructor(connection, cacheService) {
        this.connection = connection;
        this.cacheService = cacheService;
        this.metricCalculations = [
            new metrics_strategies_1.AverageOrderValueMetric(),
            new metrics_strategies_1.OrderCountMetric(),
            new metrics_strategies_1.OrderTotalMetric(),
        ];
    }
    async getMetrics(ctx, { interval, types, refresh }) {
        // Set 23:59:59.999 as endDate
        const endDate = (0, date_fns_1.endOfDay)(new Date());
        // Check if we have cached result
        const hash = (0, crypto_1.createHash)('sha1')
            .update(JSON.stringify({
            endDate,
            types: types.sort(),
            interval,
            channel: ctx.channel.token,
        }))
            .digest('base64');
        const cacheKey = `MetricsService:${hash}`;
        const cachedMetricList = await this.cacheService.get(cacheKey);
        if (cachedMetricList && refresh !== true) {
            core_1.Logger.verbose(`Returning cached metrics for channel ${ctx.channel.token}`, constants_1.loggerCtx);
            return cachedMetricList;
        }
        // No cache, calculating new metrics
        core_1.Logger.verbose(`No cache hit, calculating ${interval} metrics until ${endDate.toISOString()} for channel ${ctx.channel.token} for all orders`, constants_1.loggerCtx);
        const data = await this.loadData(ctx, interval, endDate);
        const metrics = [];
        for (const type of types) {
            const metric = this.metricCalculations.find(m => m.type === type);
            if (!metric) {
                continue;
            }
            // Calculate entry (month or week)
            const entries = [];
            data.forEach(dataPerTick => {
                entries.push(metric.calculateEntry(ctx, interval, dataPerTick));
            });
            // Create metric with calculated entries
            metrics.push({
                interval,
                title: metric.getTitle(ctx),
                type: metric.type,
                entries,
            });
        }
        await this.cacheService.set(cacheKey, metrics, { ttl: 1000 * 60 * 60 * 24 });
        return metrics;
    }
    async loadData(ctx, interval, endDate) {
        let nrOfEntries;
        let backInTimeAmount;
        const orderRepo = this.connection.getRepository(ctx, core_1.Order);
        // What function to use to get the current Tick of a date (i.e. the week or month number)
        let getTickNrFn;
        let maxTick;
        switch (interval) {
            case types_1.MetricInterval.Daily: {
                nrOfEntries = 30;
                backInTimeAmount = { days: nrOfEntries };
                getTickNrFn = date_fns_1.getDayOfYear;
                maxTick = 365;
                break;
            }
            default:
                (0, shared_utils_1.assertNever)(interval);
        }
        const startDate = (0, date_fns_1.startOfDay)((0, date_fns_1.sub)(endDate, backInTimeAmount));
        const startTick = getTickNrFn(startDate);
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
                .skip(skip)
                .take(take);
            const [items, nrOfOrders] = await query.getManyAndCount();
            orders.push(...items);
            core_1.Logger.verbose(`Fetched orders ${skip}-${skip + take} for channel ${ctx.channel.token} for ${interval} metrics`, constants_1.loggerCtx);
            skip += items.length;
            if (orders.length >= nrOfOrders) {
                hasMoreOrders = false;
            }
        }
        core_1.Logger.verbose(`Finished fetching all ${orders.length} orders for channel ${ctx.channel.token} for ${interval} metrics`, constants_1.loggerCtx);
        const dataPerInterval = new Map();
        const ticks = [];
        for (let i = 1; i <= nrOfEntries; i++) {
            if (startTick + i >= maxTick) {
                // make sure we don't go over month 12 or week 52
                ticks.push(startTick + i - maxTick);
            }
            else {
                ticks.push(startTick + i);
            }
        }
        ticks.forEach(tick => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const ordersInCurrentTick = orders.filter(order => getTickNrFn(order.orderPlacedAt) === tick);
            dataPerInterval.set(tick, {
                orders: ordersInCurrentTick,
                date: (0, date_fns_1.setDayOfYear)(endDate, tick),
            });
        });
        return dataPerInterval;
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CacheService])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map