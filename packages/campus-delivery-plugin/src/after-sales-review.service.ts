import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

/** 满意度评分（§93）：顾客对退款处理打 1-5 分 */
export interface MerchantAfterSalesReviewBucket {
    score: number;
    count: number;
}

/** 低分待跟进项（§93）：score <= 2 */
export interface MerchantAfterSalesLowReview {
    id: string;
    requestId: string;
    orderCode: string;
    customerName: string | null;
    score: number;
    comment: string | null;
    followedUp: boolean;
    createdAt: Date;
}

/** 满意度汇总（§93、§98） */
export interface MerchantAfterSalesReviewSummary {
    total: number;
    /** 平均分（保留 1 位小数，无评分为 0） */
    avgScore: number;
    /** 1-5 分档人数（固定 5 项，按分数升序） */
    distribution: MerchantAfterSalesReviewBucket[];
    /** 低分（<=2）条数 */
    lowScoreCount: number;
    /** 低分待跟进明细（最近 20 条，含已跟进） */
    lowScores: MerchantAfterSalesLowReview[];
    /** 评价标签 Top（§98）：按出现次数降序，最多 10 项 */
    topTags: Array<{ tag: string; count: number }>;
}

const DAY_MS = 86_400_000;

/** 校园日（UTC+8）起止：起含、止不含 */
function campusDayStart(v: string): Date | null {
    const s = String(v ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00+08:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function campusDayEnd(v: string): Date | null {
    const s = String(v ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00+08:00`);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() + DAY_MS);
}

/** 售后满意度回访（§93）：顾客提交评分 / 商家汇总与低分跟进 */
@Injectable()
export class AfterSalesReviewService {
    constructor(private connection: TransactionalConnection) {}

    /** 顾客提交评分（§93、§98）：仅本人且已退款完成的售后单，重复提交覆盖旧评分；tags 为可选标签 */
    async submit(
        ctx: RequestContext,
        requestId: ID,
        score: number,
        comment?: string | null,
        tags?: string[] | null,
    ): Promise<{ ok: boolean; score: number }> {
        const uid = ctx.activeUserId;
        if (!uid) throw new UserInputError('请先登录后再评价');
        const s = Math.floor(Number(score));
        if (!Number.isFinite(s) || s < 1 || s > 5) throw new UserInputError('评分应为 1-5 分');
        const text = String(comment ?? '').trim();
        if (text.length > 200) throw new UserInputError('评价内容最多 200 字');
        const tagList = (tags ?? [])
            .map(t => String(t ?? '').trim())
            .filter(Boolean);
        if (tagList.length > 5) throw new UserInputError('评价标签最多 5 个');
        if (tagList.some(t => t.length > 12)) throw new UserInputError('单个评价标签最多 12 字');
        const tagsText = tagList.length ? JSON.stringify(tagList) : null;
        const rows: any = await this.connection.rawConnection.query(
            'SELECT a.id, a.state, a."customerId", oc."channelId" AS "channelId" '
            + 'FROM after_sales_request a '
            + 'JOIN "order" o ON o.id = a."orderId" '
            + 'JOIN customer c ON c.id = a."customerId" '
            + 'JOIN order_channels_channel oc ON oc."orderId" = o.id '
            + 'WHERE a.id = $1 AND c."userId" = $2 LIMIT 1',
            [Number(requestId), Number(uid)],
        );
        const list: any[] = this.rows(rows);
        const row = list[0];
        if (!row) throw new UserInputError('售后单不存在或不属于当前用户');
        if (String(row.state) !== 'Refunded') throw new UserInputError('仅退款完成的售后单可评价');
        await this.connection.rawConnection.query(
            'INSERT INTO campus_after_sales_review ("channelId", "requestId", "customerId", score, comment, tags) '
            + 'VALUES ($1, $2, $3, $4, $5, $6) '
            + 'ON CONFLICT ("requestId") DO UPDATE SET score = EXCLUDED.score, '
            + 'comment = EXCLUDED.comment, tags = EXCLUDED.tags, "createdAt" = now(), "followedUp" = false',
            [Number(row.channelId), Number(requestId), Number(row.customerId), s, text || null, tagsText],
        );
        return { ok: true, score: s };
    }

    /** 满意度汇总（§93）：区间内均分/分档/低分待跟进，最长一年 */
    async summary(ctx: RequestContext, from: string, to: string): Promise<MerchantAfterSalesReviewSummary> {
        const start = campusDayStart(from);
        const end = campusDayEnd(to);
        if (!start || !end) throw new UserInputError('日期格式无效，应为 YYYY-MM-DD');
        if (start.getTime() > end.getTime()) throw new UserInputError('开始日期不能晚于结束日期');
        if (end.getTime() - start.getTime() > 366 * DAY_MS) throw new UserInputError('查询区间最长一年');
        const chId = Number(ctx.channelId);
        const raw = this.connection.rawConnection;
        try {
            const aggRows: any = await raw.query(
                'SELECT COUNT(*)::int AS total, COALESCE(AVG(score), 0) AS avg, '
                + 'COUNT(*) FILTER (WHERE score <= 2)::int AS low '
                + 'FROM campus_after_sales_review WHERE "channelId" = $1 '
                + 'AND "createdAt" >= $2 AND "createdAt" < $3',
                [chId, start, end],
            );
            const agg: any = this.rows(aggRows)[0] ?? {};
            const total = Number(agg.total) || 0;
            const avgScore = total ? Math.round(Number(agg.avg) * 10) / 10 : 0;
            const bucketRows: any = await raw.query(
                'SELECT score, COUNT(*)::int AS n FROM campus_after_sales_review '
                + 'WHERE "channelId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3 GROUP BY score',
                [chId, start, end],
            );
            const counts = new Map<number, number>();
            for (const r of this.rows(bucketRows)) counts.set(Number(r.score), Number(r.n) || 0);
            const distribution: MerchantAfterSalesReviewBucket[] = [1, 2, 3, 4, 5]
                .map(score => ({ score, count: counts.get(score) ?? 0 }));
            const lowRows: any = await raw.query(
                'SELECT r.id, r."requestId", r.score, r.comment, r."followedUp", r."createdAt", '
                + 'o.code AS "orderCode", c."firstName", c."lastName" '
                + 'FROM campus_after_sales_review r '
                + 'LEFT JOIN after_sales_request a ON a.id = r."requestId" '
                + 'LEFT JOIN "order" o ON o.id = a."orderId" '
                + 'LEFT JOIN customer c ON c.id = r."customerId" '
                + 'WHERE r."channelId" = $1 AND r."createdAt" >= $2 AND r."createdAt" < $3 AND r.score <= 2 '
                + 'ORDER BY r."createdAt" DESC LIMIT 20',
                [chId, start, end],
            );
            const lowScores = this.rows(lowRows).map(r => ({
                id: String(r.id),
                requestId: String(r.requestId),
                orderCode: String(r.orderCode ?? ''),
                customerName: [r.lastName, r.firstName].filter(Boolean).join('') || null,
                score: Number(r.score) || 0,
                comment: r.comment == null ? null : String(r.comment),
                followedUp: Boolean(r.followedUp),
                createdAt: new Date(r.createdAt),
            }));
            // §98：评价标签 Top（tags 为 JSON 数组文本，解析失败按无标签）
            const tagRows: any = await raw.query(
                'SELECT tags FROM campus_after_sales_review WHERE "channelId" = $1 '
                + 'AND "createdAt" >= $2 AND "createdAt" < $3 AND tags IS NOT NULL LIMIT 5000',
                [chId, start, end],
            );
            const tagCounts = new Map<string, number>();
            for (const r of this.rows(tagRows)) {
                try {
                    const parsed = JSON.parse(String(r.tags));
                    if (!Array.isArray(parsed)) continue;
                    for (const t of parsed) {
                        const tag = String(t ?? '').trim();
                        if (tag) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
                    }
                } catch {
                    // 忽略脏数据
                }
            }
            const topTags = Array.from(tagCounts.entries())
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            return {
                total,
                avgScore,
                distribution,
                lowScoreCount: Number(agg.low) || 0,
                lowScores,
                topTags,
            };
        } catch (e: any) {
            throw new UserInputError(`满意度汇总失败：${e?.message ?? e}`);
        }
    }

    /** 标记低分已跟进（§93）：仅本店渠道记录 */
    async markFollowed(ctx: RequestContext, id: ID): Promise<boolean> {
        const rows: any = await this.connection.rawConnection.query(
            'UPDATE campus_after_sales_review SET "followedUp" = true WHERE id = $1 AND "channelId" = $2 RETURNING id',
            [Number(id), Number(ctx.channelId)],
        );
        return this.rows(rows).length > 0;
    }

    /** 兼容不同驱动的返回结构：部分驱动把结果再包一层数组 */
    private rows(result: any): any[] {
        if (!Array.isArray(result)) return [];
        return Array.isArray(result[0]) ? result[0] : result;
    }
}
