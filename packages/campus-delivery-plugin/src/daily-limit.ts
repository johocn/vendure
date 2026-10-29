/**
 * 菜品每日限量 / 每人限购（§68）。
 * 口径：配置为 null 或 0 = 不限；额度按「校园本地日」（UTC+8）统计已支付订单，
 * 不落库当日用量表——次日自然归零，无需定时任务重置。
 */
export const DAILY_LIMIT_MAX = 9999;

/** 占用当日额度的订单状态（已支付 / 已履约）；草稿、待付款、已取消不计 */
export const DAILY_LIMIT_PAID_STATES = [
    'PaymentAuthorized',
    'PaymentSettled',
    'PartiallyShipped',
    'Shipped',
    'PartiallyDelivered',
    'Delivered',
];

/** 限量配置归一：null / 空 / 非正数 / 非法 → null（不限），否则取整 */
export function normalizeLimit(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(DAILY_LIMIT_MAX, Math.floor(n));
}

/** 剩余可售份数：不限返回 null，售完返回 0（不为负） */
export function remainingOf(limit: number | null, sold: number): number | null {
    if (limit == null) return null;
    return Math.max(0, limit - Math.max(0, Number(sold) || 0));
}

export interface LimitCheckLine {
    name: string;
    quantity: number;
    dailyLimit: number | null;
    perUserLimit: number | null;
    /** 当日其他订单已售（不含本单） */
    soldToday: number;
    /** 当日该顾客已购（不含本单） */
    mineToday: number;
}

/** 下单前置校验：命中限量/限购时返回可直接展示的错误文案，否则 null */
export function checkDailyLimit(line: LimitCheckLine): string | null {
    const qty = Math.max(0, Number(line.quantity) || 0);
    if (line.dailyLimit != null && line.soldToday + qty > line.dailyLimit) {
        const left = Math.max(0, line.dailyLimit - line.soldToday);
        return `商品「${line.name}」今日限量 ${line.dailyLimit} 份，还剩 ${left} 份，请调整数量`;
    }
    if (line.perUserLimit != null && line.mineToday + qty > line.perUserLimit) {
        return `商品「${line.name}」每人限购 ${line.perUserLimit} 份，您今日已购买 ${line.mineToday} 份`;
    }
    return null;
}

/** 校园本地日 [00:00, 次日 00:00) 的 UTC 时间范围（固定 UTC+8） */
export function localDayRange(now = Date.now(), tzOffsetMinutes = 480): { start: Date; end: Date } {
    const local = new Date(now + tzOffsetMinutes * 60_000);
    const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    return {
        start: new Date(midnight - tzOffsetMinutes * 60_000),
        end: new Date(midnight - tzOffsetMinutes * 60_000 + 86_400_000),
    };
}

const numList = (v: any) => (Array.isArray(v) ? v : []).map((x: any) => Number(x)).filter(n => Number.isFinite(n));

/** 当日已售份数（按商品）：只统计已支付订单；customerId 存在时只统计该顾客 */
export async function queryDailySold(
    raw: any,
    channelId: number,
    productIds: number[],
    opts: { customerId?: number | null; excludeOrderId?: number | null; now?: number } = {},
): Promise<Map<number, number>> {
    const ids = numList(productIds);
    const out = new Map<number, number>();
    if (!ids.length) return out;
    const { start, end } = localDayRange(opts.now ?? Date.now());
    const rows: any = await raw.query(
        'SELECT pv."productId" AS pid, SUM(ol.quantity)::int AS qty '
        + 'FROM order_line ol '
        + 'JOIN product_variant pv ON pv.id = ol."productVariantId" '
        + 'JOIN "order" o ON o.id = ol."orderId" '
        + 'WHERE o."channelId" = $1 AND o."orderPlacedAt" >= $2 AND o."orderPlacedAt" < $3 '
        + 'AND o.state = ANY($4::text[]) AND pv."productId" = ANY($5::int[]) '
        + 'AND ($6::int IS NULL OR o."customerId" = $6) '
        + 'AND ($7::int IS NULL OR o.id <> $7) '
        + 'GROUP BY pv."productId"',
        [
            channelId, start, end, DAILY_LIMIT_PAID_STATES,
            ids, opts.customerId ?? null, opts.excludeOrderId ?? null,
        ],
    );
    const list: any[] = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    for (const r of list ?? []) out.set(Number(r.pid), Number(r.qty) || 0);
    return out;
}

/** 下单闸门：返回首个命中限量/限购的商品错误文案（null=全部通过） */
export async function findDailyLimitViolation(
    conn: { rawConnection: any },
    channelId: number,
    orderId: number,
): Promise<string | null> {
    const raw = conn.rawConnection;
    const rows: any = await raw.query(
        'SELECT pv."productId" AS pid, ol.quantity::int AS qty, o."customerId" AS "customerId", '
        + 'COALESCE(p."customFieldsWaimaidailylimit", 0) AS dl, '
        + 'COALESCE(p."customFieldsWaimaiperuserlimit", 0) AS pul, '
        + 'COALESCE(pt.name, \'商品 #\' || p.id) AS name '
        + 'FROM order_line ol '
        + 'JOIN "order" o ON o.id = ol."orderId" '
        + 'JOIN product_variant pv ON pv.id = ol."productVariantId" '
        + 'JOIN product p ON p.id = pv."productId" '
        + 'LEFT JOIN LATERAL (SELECT name FROM product_translation pt WHERE pt."baseId" = p.id '
        + 'ORDER BY (pt."languageCode" = \'zh_Hans\') DESC LIMIT 1) pt ON true '
        + 'WHERE ol."orderId" = $1',
        [orderId],
    );
    const lines: any[] = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    const limited = (lines ?? []).filter((l: any) => Number(l.dl) > 0 || Number(l.pul) > 0);
    if (!limited.length) return null;

    const customerId = lines?.[0]?.customerId == null ? null : Number(lines[0].customerId);
    const ids = [...new Set(limited.map((l: any) => Number(l.pid)))];
    const soldMap = await queryDailySold(raw, channelId, ids, { excludeOrderId: orderId });
    const mineMap = customerId == null
        ? new Map<number, number>()
        : await queryDailySold(raw, channelId, ids, { excludeOrderId: orderId, customerId });

    for (const l of limited) {
        const pid = Number(l.pid);
        const msg = checkDailyLimit({
            name: String(l.name ?? ''),
            quantity: Number(l.qty) || 0,
            dailyLimit: normalizeLimit(l.dl),
            perUserLimit: normalizeLimit(l.pul),
            soldToday: soldMap.get(pid) ?? 0,
            mineToday: mineMap.get(pid) ?? 0,
        });
        if (msg) return msg;
    }
    return null;
}
