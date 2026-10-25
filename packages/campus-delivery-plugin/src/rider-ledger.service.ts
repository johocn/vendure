// P8-4 后台补齐（2026-10-25）：
// ① 骑手分成台账：rider_earning 原先只有写入与骑手端自查，运营无台账可对账；
// ② 骑手轨迹：实时位置仅写订单 customFields，送达即清空，事后无法追溯配送路线。
// 本服务提供两者只读查询（渠道隔离 + 分页/合计 + 轨迹距离估算），写入口仍在 RiderTaskService。
import { Customer, ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { Injectable } from '@nestjs/common';

const DAY_MS = 86_400_000;
/** 单次轨迹最多返回点数：前端折线按比例抽稀，避免一次回传几十万点 */
const MAX_TRACK_POINTS = 5000;

/** PG 原生查询在不同驱动形态下可能返回 [rows, affected]：统一取行数组 */
function rowsOf(res: any): any[] {
    const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
    return Array.isArray(rows) ? rows : [];
}

/** YYYY-MM-DD（东八区自然日）→ 当日 00:00 时间戳 */
function campusDayStart(date: string, field: string): number {
    const text = String(date ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new UserInputError(`${field}格式应为 YYYY-MM-DD`);
    const ts = new Date(`${text}T00:00:00+08:00`).getTime();
    if (!Number.isFinite(ts)) throw new UserInputError(`${field}不是有效日期`);
    return ts;
}

/** 球面直线距离（米），与 RiderTaskService 的 ETA 估算保持一致 */
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

export interface RiderEarningQuery {
    from?: string;
    to?: string;
    riderCustomerId?: ID;
    status?: string;
    orderCode?: string;
    skip?: number;
    take?: number;
}

@Injectable()
export class RiderLedgerService {
    constructor(private connection: TransactionalConnection) {}

    /** 分成台账：按渠道 + 日期/骑手/状态/订单号筛选，返回当前页与全量合计（金额单位分） */
    async earningsLedger(ctx: RequestContext, input: RiderEarningQuery) {
        const where: string[] = ['e."channelId" = $1'];
        const params: any[] = [ctx.channelId];
        const add = (value: any): string => {
            params.push(value);
            return `$${params.length}`;
        };
        if (input.from) {
            where.push(`e."createdAt" >= ${add(new Date(campusDayStart(input.from, '开始日期')))}`);
        }
        if (input.to) {
            where.push(`e."createdAt" < ${add(new Date(campusDayStart(input.to, '结束日期') + DAY_MS))}`);
        }
        if (input.riderCustomerId != null && input.riderCustomerId !== '') {
            const riderId = Number(input.riderCustomerId);
            if (!Number.isFinite(riderId) || riderId <= 0) throw new UserInputError('骑手不存在');
            where.push(`e."riderCustomerId" = ${add(riderId)}`);
        }
        const status = String(input.status ?? '').trim();
        if (status && status !== 'ALL') {
            if (!['credited', 'pending', 'crediting'].includes(status)) throw new UserInputError('分成状态不合法');
            where.push(`e.status = ${add(status)}`);
        }
        const code = String(input.orderCode ?? '').trim();
        if (code) {
            if (code.length > 64) throw new UserInputError('订单号过长');
            if (/^\d+$/.test(code)) {
                where.push(`e."orderId" = ${add(Number(code))}`);
            } else {
                where.push(`o.code ILIKE ${add(`%${code}%`)}`);
            }
        }
        const safeSkip = Math.max(0, Number(input.skip ?? 0) || 0);
        const safeTake = Math.min(Math.max(Number(input.take ?? 20) || 20, 1), 200);
        const whereSql = where.join(' AND ');
        const [summaryRows, itemRows] = await Promise.all([
            this.connection.rawConnection.query(
                'SELECT COALESCE(SUM(e.amount), 0)::int AS "sumAmount", '
                + 'COALESCE(SUM(e.tip), 0)::int AS "sumTip", COUNT(*)::int AS total '
                + `FROM rider_earning e LEFT JOIN "order" o ON o.id = e."orderId" WHERE ${whereSql}`,
                params,
            ),
            this.connection.rawConnection.query(
                'SELECT e.id, e."orderId", o.code AS "orderCode", e."riderCustomerId", '
                + 'e.amount, e.tip, e.status, e."createdAt" '
                + `FROM rider_earning e LEFT JOIN "order" o ON o.id = e."orderId" WHERE ${whereSql} `
                + 'ORDER BY e."createdAt" DESC, e.id DESC LIMIT $' + (params.length + 1)
                + ' OFFSET $' + (params.length + 2),
                [...params, safeTake, safeSkip],
            ),
        ]);
        const summary = rowsOf(summaryRows)[0] ?? {};
        const rows = rowsOf(itemRows);
        const nameOf = await this.riderNames(ctx, rows.map(r => Number(r.riderCustomerId)));
        return {
            items: rows.map(r => ({
                id: String(r.id),
                orderId: String(r.orderId),
                orderCode: r.orderCode ?? null,
                riderCustomerId: String(r.riderCustomerId),
                riderName: nameOf.get(Number(r.riderCustomerId)) ?? '骑手',
                amount: Number(r.amount ?? 0),
                tip: Number(r.tip ?? 0),
                status: String(r.status ?? ''),
                createdAt: r.createdAt,
            })),
            total: Number(summary.total ?? 0),
            sumAmount: Number(summary.sumAmount ?? 0),
            sumTip: Number(summary.sumTip ?? 0),
        };
    }

    /** 订单维度轨迹：传订单 ID 或订单号（#A1024）均可，单趟配送完整点位（升序） */
    async orderTrack(ctx: RequestContext, orderId?: ID, orderCode?: string) {
        let id = Number(orderId);
        if (!Number.isFinite(id) || id <= 0) {
            const code = String(orderCode ?? '').trim();
            if (!code) throw new UserInputError('请输入订单号或订单 ID');
            if (code.length > 64) throw new UserInputError('订单号过长');
            const found = await this.connection.rawConnection.query(
                'SELECT o.id FROM "order" o JOIN "order_channels_channel" oc ON oc."orderId" = o.id '
                + 'WHERE oc."channelId" = $1 AND o.code = $2 LIMIT 1',
                [ctx.channelId, code],
            );
            id = Number(rowsOf(found)[0]?.id ?? NaN);
            if (!Number.isFinite(id) || id <= 0) throw new UserInputError('订单不存在或不属于当前店铺');
        }
        const res = await this.connection.rawConnection.query(
            'SELECT l.id, l."orderId", o.code AS "orderCode", l."riderCustomerId", l.lat, l.lng, l."reportedAt" '
            + 'FROM campus_rider_location l LEFT JOIN "order" o ON o.id = l."orderId" '
            + 'WHERE l."orderId" = $1 AND l."channelId" = $2 '
            + 'ORDER BY l."reportedAt" ASC, l.id ASC LIMIT $3',
            [id, ctx.channelId, MAX_TRACK_POINTS],
        );
        return this.toTrack(ctx, rowsOf(res), { orderId: String(id) });
    }

    /** 骑手时段轨迹：骑手 + 东八区自然日区间（含结束日）跨单点位，按时间升序 */
    async riderTrack(ctx: RequestContext, riderCustomerId: ID, from: string, to: string) {
        const riderId = Number(riderCustomerId);
        if (!Number.isFinite(riderId) || riderId <= 0) throw new UserInputError('骑手不存在');
        const start = campusDayStart(from, '开始日期');
        const end = campusDayStart(to, '结束日期') + DAY_MS;
        if (end <= start) throw new UserInputError('结束日期不能早于开始日期');
        if (end - start > 31 * DAY_MS) throw new UserInputError('查询区间不能超过 31 天');
        const res = await this.connection.rawConnection.query(
            'SELECT l.id, l."orderId", o.code AS "orderCode", l."riderCustomerId", l.lat, l.lng, l."reportedAt" '
            + 'FROM campus_rider_location l LEFT JOIN "order" o ON o.id = l."orderId" '
            + 'WHERE l."channelId" = $1 AND l."riderCustomerId" = $2 '
            + 'AND l."reportedAt" >= $3 AND l."reportedAt" < $4 '
            + 'ORDER BY l."reportedAt" ASC, l.id ASC LIMIT $5',
            [ctx.channelId, riderId, new Date(start), new Date(end), MAX_TRACK_POINTS],
        );
        const rows = rowsOf(res);
        const track = await this.toTrack(ctx, rows, { riderCustomerId: String(riderId) });
        return { ...track, riderName: (await this.riderNames(ctx, [riderId])).get(riderId) ?? '骑手' };
    }

    private async toTrack(ctx: RequestContext, rows: any[], extra: Record<string, any>) {
        const points = rows.map(r => ({
            id: String(r.id),
            orderId: String(r.orderId),
            orderCode: r.orderCode ?? null,
            riderCustomerId: String(r.riderCustomerId),
            lat: Number(r.lat),
            lng: Number(r.lng),
            reportedAt: r.reportedAt,
        }));
        let distance = 0;
        for (let i = 1; i < points.length; i++) distance += haversineMeters(points[i - 1], points[i]);
        const riderCustomerId = points[0]?.riderCustomerId ?? extra.riderCustomerId ?? null;
        return {
            ...extra,
            riderCustomerId,
            orderCode: points[0]?.orderCode ?? null,
            points,
            distanceMeters: Math.round(distance),
            truncated: rows.length >= MAX_TRACK_POINTS,
        };
    }

    private async riderNames(ctx: RequestContext, ids: number[]): Promise<Map<number, string>> {
        const unique = [...new Set(ids.filter(n => Number.isFinite(n) && n > 0))];
        if (!unique.length) return new Map();
        const riders = await this.connection.getRepository(ctx, Customer).findByIds(unique as any);
        return new Map(
            riders.map(c => [
                Number(c.id),
                ((c.customFields as any)?.riderRealName || c.firstName || '骑手') as string,
            ]),
        );
    }
}
