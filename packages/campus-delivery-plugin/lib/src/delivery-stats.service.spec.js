"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const delivery_stats_service_1 = require("./delivery-stats.service");
const now = new Date('2026-10-23T15:30:00+08:00').getTime();
const min = (m, base = now) => new Date(base - m * 60000);
const order = (id, ch, cf, extra = {}) => {
    var _a;
    return (Object.assign({ id, code: `A${id}`, state: 'Delivered', createdAt: (_a = cf.createdAt) !== null && _a !== void 0 ? _a : min(60), channels: [{ id: ch, code: ch === 9 ? '__default_channel__' : `shop-${ch}` }], customFields: cf }, extra));
};
(0, vitest_1.describe)('normalizeRange / windowStartOf', () => {
    (0, vitest_1.it)('非法 range 回退 7d', () => {
        (0, vitest_1.expect)((0, delivery_stats_service_1.normalizeRange)('xx')).toBe('7d');
        (0, vitest_1.expect)((0, delivery_stats_service_1.normalizeRange)(undefined)).toBe('7d');
        (0, vitest_1.expect)((0, delivery_stats_service_1.normalizeRange)('today')).toBe('today');
        (0, vitest_1.expect)((0, delivery_stats_service_1.normalizeRange)('30d')).toBe('30d');
    });
    (0, vitest_1.it)('today 窗口起点为本地 0 点', () => {
        const ws = (0, delivery_stats_service_1.windowStartOf)('today', now);
        const d = new Date(ws);
        (0, vitest_1.expect)(d.getHours()).toBe(0);
        (0, vitest_1.expect)(d.getMinutes()).toBe(0);
        (0, vitest_1.expect)(d.getDate()).toBe(23);
    });
    (0, vitest_1.it)('7d 窗口起点为 now-7天', () => {
        (0, vitest_1.expect)((0, delivery_stats_service_1.windowStartOf)('7d', now)).toBe(now - 7 * 24 * 3600000);
    });
});
(0, vitest_1.describe)('aggregateStats', () => {
    (0, vitest_1.it)('KPI：单量/准点率/平均送达/赔付数（grace 边界：恰好 grace 记准点）', () => {
        const grace = 10;
        const orders = [
            // 准点：late=9min
            order(1, 1, { promisedAt: min(30), deliveredAt: min(21), assignedAt: min(28), timeoutCompensatedAt: null }),
            // 恰好 grace=10min → 准点
            order(2, 1, { promisedAt: min(30), deliveredAt: min(20), assignedAt: min(28) }),
            // 超 grace 1min → 迟到，无赔付闸（不计 compensated）
            order(3, 1, { promisedAt: min(30), deliveredAt: min(19), assignedAt: min(28) }),
            // 已赔付单
            order(4, 1, { promisedAt: min(40), deliveredAt: min(5), assignedAt: min(38), timeoutCompensatedAt: min(4), timeoutAttribution: 'merchant' }),
        ];
        const res = (0, delivery_stats_service_1.aggregateStats)({
            orders,
            graceByChannel: new Map([[1, grace]]),
            windowStart: now - 24 * 3600000,
            now,
            range: '7d',
        });
        (0, vitest_1.expect)(res.kpis.totalOrders).toBe(4);
        (0, vitest_1.expect)(res.kpis.onTimeRate).toBe(50); // 2/4
        // 在途均值：7,8,9,33 → 14.25（round1 → 14.3）
        (0, vitest_1.expect)(res.kpis.avgDeliveryMinutes).toBe(14.3);
        (0, vitest_1.expect)(res.kpis.timeoutCompensated).toBe(1);
        (0, vitest_1.expect)(res.attribution).toEqual({ merchant: 1, rider: 0, platform: 0 });
    });
    (0, vitest_1.it)('Cancelled 单不计入单量', () => {
        const res = (0, delivery_stats_service_1.aggregateStats)({
            orders: [order(1, 1, { promisedAt: min(30), deliveredAt: min(20) }), order(2, 1, {}, { state: 'Cancelled' })],
            graceByChannel: new Map([[1, 10]]),
            windowStart: now - 24 * 3600000,
            now,
            range: '7d',
        });
        (0, vitest_1.expect)(res.kpis.totalOrders).toBe(1);
    });
    (0, vitest_1.it)('环节耗时：接单=createdAt→assignedAt，在途=assignedAt→deliveredAt，无数据段为 0', () => {
        const orders = [
            order(1, 1, { createdAt: min(40), promisedAt: min(30), assignedAt: min(30), deliveredAt: min(10) }),
        ];
        const res = (0, delivery_stats_service_1.aggregateStats)({
            orders,
            graceByChannel: new Map([[1, 10]]),
            windowStart: now - 24 * 3600000,
            now,
            range: '7d',
        });
        (0, vitest_1.expect)(res.stages).toEqual([
            { key: 'assign', label: '接单', avgMinutes: 10 },
            { key: 'transit', label: '在途', avgMinutes: 20 },
        ]);
    });
    (0, vitest_1.it)('接单段排除预约单（scheduledFor 非空：assignedAt 在放量后写入，跨时长不代表接单效率）', () => {
        const orders = [
            order(1, 1, { createdAt: min(40), assignedAt: min(30), scheduledFor: min(-600) }), // 预约单
            order(2, 1, { createdAt: min(20), assignedAt: min(10) }), // 即时单
        ];
        const res = (0, delivery_stats_service_1.aggregateStats)({
            orders,
            graceByChannel: new Map([[1, 10]]),
            windowStart: now - 24 * 3600000,
            now,
            range: '7d',
        });
        (0, vitest_1.expect)(res.stages[0].avgMinutes).toBe(10); // 仅即时单计入
        (0, vitest_1.expect)(res.kpis.totalOrders).toBe(2); // 单量不受影响
    });
    (0, vitest_1.it)('dailyTrend 7d：逐日出点，无单日补零', () => {
        const res = (0, delivery_stats_service_1.aggregateStats)({
            orders: [order(1, 1, { promisedAt: min(30), deliveredAt: min(20), createdAt: min(60) })],
            graceByChannel: new Map([[1, 10]]),
            windowStart: now - 7 * 24 * 3600000,
            now,
            range: '7d',
        });
        (0, vitest_1.expect)(res.dailyTrend).toHaveLength(7);
        (0, vitest_1.expect)(res.dailyTrend[6].orders).toBe(1);
        (0, vitest_1.expect)(res.dailyTrend[0].orders).toBe(0);
        (0, vitest_1.expect)(res.dailyTrend[6].onTimeRate).toBe(100);
        (0, vitest_1.expect)(res.dailyTrend[0].onTimeRate).toBe(0);
    });
    (0, vitest_1.it)('dailyTrend today：按小时出点至当前小时', () => {
        const h = new Date(now).getHours();
        const res = (0, delivery_stats_service_1.aggregateStats)({
            orders: [order(1, 1, { promisedAt: min(30), deliveredAt: min(20), createdAt: min(5) })],
            graceByChannel: new Map([[1, 10]]),
            windowStart: (0, delivery_stats_service_1.windowStartOf)('today', now),
            now,
            range: 'today',
        });
        (0, vitest_1.expect)(res.dailyTrend).toHaveLength(h + 1);
        (0, vitest_1.expect)(res.dailyTrend[h].orders).toBe(1);
        (0, vitest_1.expect)(res.dailyTrend[h].date.endsWith(':00')).toBe(true);
    });
    (0, vitest_1.it)('店铺对比：按渠道分组，default 渠道被排除取名，无承诺单不计准点分母', () => {
        const orders = [
            order(1, 1, { promisedAt: min(30), deliveredAt: min(20) }),
            order(2, 1, { promisedAt: min(30), deliveredAt: min(5) }), // 迟到
            order(3, 2, { promisedAt: min(30), deliveredAt: min(25) }),
            order(4, 9, { promisedAt: min(30), deliveredAt: min(25) }), // default 渠道名被跳过
            order(5, 1, {}), // 无承诺：计单量不计准点
        ];
        const res = (0, delivery_stats_service_1.aggregateStats)({
            orders,
            graceByChannel: new Map([[1, 10], [2, 10]]),
            windowStart: now - 24 * 3600000,
            now,
            range: '7d',
        });
        (0, vitest_1.expect)(res.storeComparison).toHaveLength(3);
        const s1 = res.storeComparison.find(s => s.channelId === '1');
        (0, vitest_1.expect)(s1.channelName).toBe('shop-1');
        (0, vitest_1.expect)(s1.orders).toBe(3);
        (0, vitest_1.expect)(s1.onTimeRate).toBe(50); // 1/2
        (0, vitest_1.expect)(res.storeComparison[0].orders).toBe(3); // 排序按单量降序
        // 无承诺单不影响整体准点分母（计分单：1,2,3,4 → 准点 1,3,4）
        (0, vitest_1.expect)(res.kpis.onTimeRate).toBe(75); // 3/4
    });
    (0, vitest_1.it)('各渠道 grace 独立生效（店 A grace=10 准点、店 B grace=60 同样延迟记准点）', () => {
        const deliveredAt = min(20);
        const orders = [
            order(1, 1, { promisedAt: min(40), deliveredAt }),
            order(2, 2, { promisedAt: min(40), deliveredAt }),
        ];
        const res = (0, delivery_stats_service_1.aggregateStats)({
            orders,
            graceByChannel: new Map([[1, 10], [2, 60]]),
            windowStart: now - 24 * 3600000,
            now,
            range: '7d',
        });
        const s1 = res.storeComparison.find(s => s.channelId === '1');
        const s2 = res.storeComparison.find(s => s.channelId === '2');
        (0, vitest_1.expect)(s1.onTimeRate).toBe(0); // late=20 > 10
        (0, vitest_1.expect)(s2.onTimeRate).toBe(100); // late=20 ≤ 60
    });
});
(0, vitest_1.describe)('DeliveryStatsService.stats 口径', () => {
    (0, vitest_1.it)('SQL 只取校园履约单（hallStatus 非空）', async () => {
        const andWhere = vitest_1.vi.fn().mockReturnThis();
        const qb = {
            leftJoinAndSelect: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere,
            getMany: vitest_1.vi.fn().mockResolvedValue([]),
        };
        const repo = { createQueryBuilder: vitest_1.vi.fn(() => qb), find: vitest_1.vi.fn().mockResolvedValue([]) };
        const svc = new delivery_stats_service_1.DeliveryStatsService({ getRepository: vitest_1.vi.fn(() => repo) });
        await svc.stats({}, 'today');
        (0, vitest_1.expect)(andWhere).toHaveBeenCalledWith('order.customFields.hallStatus IS NOT NULL');
    });
});
//# sourceMappingURL=delivery-stats.service.spec.js.map