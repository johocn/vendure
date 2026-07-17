"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderTotalMetric = exports.OrderCountMetric = exports.AverageOrderValueMetric = void 0;
exports.getMonthName = getMonthName;
const types_1 = require("../types");
function getMonthName(monthNr) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[monthNr];
}
/**
 * Calculates the average order value per month/week
 */
class AverageOrderValueMetric {
    constructor() {
        this.type = types_1.MetricType.AverageOrderValue;
    }
    getTitle(ctx) {
        return 'average-order-value';
    }
    calculateEntry(ctx, interval, data) {
        const label = data.date.toISOString();
        if (!data.orders.length) {
            return {
                label,
                value: 0,
            };
        }
        const total = data.orders.map(o => o.totalWithTax).reduce((_total, current) => _total + current);
        const average = Math.round(total / data.orders.length);
        return {
            label,
            value: average,
        };
    }
}
exports.AverageOrderValueMetric = AverageOrderValueMetric;
/**
 * Calculates number of orders
 */
class OrderCountMetric {
    constructor() {
        this.type = types_1.MetricType.OrderCount;
    }
    getTitle(ctx) {
        return 'order-count';
    }
    calculateEntry(ctx, interval, data) {
        const label = data.date.toISOString();
        return {
            label,
            value: data.orders.length,
        };
    }
}
exports.OrderCountMetric = OrderCountMetric;
/**
 * Calculates order total
 */
class OrderTotalMetric {
    constructor() {
        this.type = types_1.MetricType.OrderTotal;
    }
    getTitle(ctx) {
        return 'order-totals';
    }
    calculateEntry(ctx, interval, data) {
        const label = data.date.toISOString();
        return {
            label,
            value: data.orders.map(o => o.totalWithTax).reduce((_total, current) => _total + current, 0),
        };
    }
}
exports.OrderTotalMetric = OrderTotalMetric;
//# sourceMappingURL=metrics-strategies.js.map