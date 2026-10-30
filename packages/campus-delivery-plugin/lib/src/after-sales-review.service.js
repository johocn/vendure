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
exports.AfterSalesReviewService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const DAY_MS = 86400000;
/** 校园日（UTC+8）起止：起含、止不含 */
function campusDayStart(v) {
    const s = String(v !== null && v !== void 0 ? v : '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return null;
    const d = new Date(`${s}T00:00:00+08:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}
function campusDayEnd(v) {
    const s = String(v !== null && v !== void 0 ? v : '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return null;
    const d = new Date(`${s}T00:00:00+08:00`);
    if (Number.isNaN(d.getTime()))
        return null;
    return new Date(d.getTime() + DAY_MS);
}
/** 售后满意度回访（§93）：顾客提交评分 / 商家汇总与低分跟进 */
let AfterSalesReviewService = class AfterSalesReviewService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 顾客提交评分（§93）：仅本人且已退款完成的售后单，重复提交覆盖旧评分 */
    async submit(ctx, requestId, score, comment) {
        const uid = ctx.activeUserId;
        if (!uid)
            throw new core_1.UserInputError('请先登录后再评价');
        const s = Math.floor(Number(score));
        if (!Number.isFinite(s) || s < 1 || s > 5)
            throw new core_1.UserInputError('评分应为 1-5 分');
        const text = String(comment !== null && comment !== void 0 ? comment : '').trim();
        if (text.length > 200)
            throw new core_1.UserInputError('评价内容最多 200 字');
        const rows = await this.connection.rawConnection.query('SELECT a.id, a.state, a."customerId", oc."channelId" AS "channelId" '
            + 'FROM after_sales_request a '
            + 'JOIN "order" o ON o.id = a."orderId" '
            + 'JOIN customer c ON c.id = a."customerId" '
            + 'JOIN order_channels_channel oc ON oc."orderId" = o.id '
            + 'WHERE a.id = $1 AND c."userId" = $2 LIMIT 1', [Number(requestId), Number(uid)]);
        const list = this.rows(rows);
        const row = list[0];
        if (!row)
            throw new core_1.UserInputError('售后单不存在或不属于当前用户');
        if (String(row.state) !== 'Refunded')
            throw new core_1.UserInputError('仅退款完成的售后单可评价');
        await this.connection.rawConnection.query('INSERT INTO campus_after_sales_review ("channelId", "requestId", "customerId", score, comment) '
            + 'VALUES ($1, $2, $3, $4, $5) '
            + 'ON CONFLICT ("requestId") DO UPDATE SET score = EXCLUDED.score, '
            + 'comment = EXCLUDED.comment, "createdAt" = now(), "followedUp" = false', [Number(row.channelId), Number(requestId), Number(row.customerId), s, text || null]);
        return { ok: true, score: s };
    }
    /** 满意度汇总（§93）：区间内均分/分档/低分待跟进，最长一年 */
    async summary(ctx, from, to) {
        var _a, _b;
        const start = campusDayStart(from);
        const end = campusDayEnd(to);
        if (!start || !end)
            throw new core_1.UserInputError('日期格式无效，应为 YYYY-MM-DD');
        if (start.getTime() > end.getTime())
            throw new core_1.UserInputError('开始日期不能晚于结束日期');
        if (end.getTime() - start.getTime() > 366 * DAY_MS)
            throw new core_1.UserInputError('查询区间最长一年');
        const chId = Number(ctx.channelId);
        const raw = this.connection.rawConnection;
        try {
            const aggRows = await raw.query('SELECT COUNT(*)::int AS total, COALESCE(AVG(score), 0) AS avg, '
                + 'COUNT(*) FILTER (WHERE score <= 2)::int AS low '
                + 'FROM campus_after_sales_review WHERE "channelId" = $1 '
                + 'AND "createdAt" >= $2 AND "createdAt" < $3', [chId, start, end]);
            const agg = (_a = this.rows(aggRows)[0]) !== null && _a !== void 0 ? _a : {};
            const total = Number(agg.total) || 0;
            const avgScore = total ? Math.round(Number(agg.avg) * 10) / 10 : 0;
            const bucketRows = await raw.query('SELECT score, COUNT(*)::int AS n FROM campus_after_sales_review '
                + 'WHERE "channelId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3 GROUP BY score', [chId, start, end]);
            const counts = new Map();
            for (const r of this.rows(bucketRows))
                counts.set(Number(r.score), Number(r.n) || 0);
            const distribution = [1, 2, 3, 4, 5]
                .map(score => { var _a; return ({ score, count: (_a = counts.get(score)) !== null && _a !== void 0 ? _a : 0 }); });
            const lowRows = await raw.query('SELECT r.id, r."requestId", r.score, r.comment, r."followedUp", r."createdAt", '
                + 'o.code AS "orderCode", c."firstName", c."lastName" '
                + 'FROM campus_after_sales_review r '
                + 'LEFT JOIN after_sales_request a ON a.id = r."requestId" '
                + 'LEFT JOIN "order" o ON o.id = a."orderId" '
                + 'LEFT JOIN customer c ON c.id = r."customerId" '
                + 'WHERE r."channelId" = $1 AND r."createdAt" >= $2 AND r."createdAt" < $3 AND r.score <= 2 '
                + 'ORDER BY r."createdAt" DESC LIMIT 20', [chId, start, end]);
            const lowScores = this.rows(lowRows).map(r => {
                var _a;
                return ({
                    id: String(r.id),
                    requestId: String(r.requestId),
                    orderCode: String((_a = r.orderCode) !== null && _a !== void 0 ? _a : ''),
                    customerName: [r.lastName, r.firstName].filter(Boolean).join('') || null,
                    score: Number(r.score) || 0,
                    comment: r.comment == null ? null : String(r.comment),
                    followedUp: Boolean(r.followedUp),
                    createdAt: new Date(r.createdAt),
                });
            });
            return {
                total,
                avgScore,
                distribution,
                lowScoreCount: Number(agg.low) || 0,
                lowScores,
            };
        }
        catch (e) {
            throw new core_1.UserInputError(`满意度汇总失败：${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`);
        }
    }
    /** 标记低分已跟进（§93）：仅本店渠道记录 */
    async markFollowed(ctx, id) {
        const rows = await this.connection.rawConnection.query('UPDATE campus_after_sales_review SET "followedUp" = true WHERE id = $1 AND "channelId" = $2 RETURNING id', [Number(id), Number(ctx.channelId)]);
        return this.rows(rows).length > 0;
    }
    /** 兼容不同驱动的返回结构：部分驱动把结果再包一层数组 */
    rows(result) {
        if (!Array.isArray(result))
            return [];
        return Array.isArray(result[0]) ? result[0] : result;
    }
};
exports.AfterSalesReviewService = AfterSalesReviewService;
exports.AfterSalesReviewService = AfterSalesReviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], AfterSalesReviewService);
//# sourceMappingURL=after-sales-review.service.js.map