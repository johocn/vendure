import { OrderProcess, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { isWithinBusinessHours } from './business-hours';
import { findDailyLimitViolation } from './daily-limit';

/**
 * 下单前置闸门（进入 ArrangingPayment 时校验）：
 * 1) 店铺营业时间：Channel.customFields.waimaiBusinessHours 解析，打烊拦截（跑腿单豁免）；
 * 2) 黑名单：用户 / 手机号命中 active 记录即拦截；
 * 3) 商品沽清：订单行含已售罄商品（Product.customFields.waimaiSoldOut）即拦截；
 * 4) 每日限量 / 每人限购：订单行数量超过商品当日剩余额度即拦截。
 *
 * connection 用模块级引用（与 min-order.process / shipping-calculator 同模式）。
 */
let connRef: TransactionalConnection | null = null;

export function bindOrderGateConnection(conn: TransactionalConnection) {
    connRef = conn;
}

export const BLACKLIST_MESSAGE = '该账号暂不可下单，如有疑问请联系商家客服';

/** 黑名单校验：返回 true 表示命中（导出便于单测） */
export async function isBlacklisted(
    conn: TransactionalConnection,
    channelId: number,
    orderId: number,
): Promise<boolean> {
    const rows: any = await conn.rawConnection.query(
        'SELECT c.id AS "customerId", c."phoneNumber" AS phone '
        + 'FROM "order" o JOIN customer c ON c.id = o."customerId" WHERE o.id = $1',
        [orderId],
    );
    const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    const customer = list?.[0];
    if (!customer) return false;
    const hit: any = await conn.rawConnection.query(
        'SELECT 1 FROM campus_blacklist b WHERE b."channelId" = $1 AND b.active = true '
        + 'AND ((b.type = \'user\' AND b."customerId" = $2) OR (b.type = \'phone\' AND b.phone = $3)) LIMIT 1',
        [channelId, Number(customer.customerId), customer.phone ?? null],
    );
    const hits = Array.isArray(hit) && Array.isArray(hit[0]) ? hit[0] : hit;
    return Array.isArray(hits) && hits.length > 0;
}

/** 沽清校验：返回首个售罄商品名（null=全部可售） */
export async function findSoldOutProductName(
    conn: TransactionalConnection,
    orderId: number,
): Promise<string | null> {
    const rows: any = await conn.rawConnection.query(
        'SELECT pt.name FROM order_line ol '
        + 'JOIN product_variant pv ON pv.id = ol."productVariantId" '
        + 'JOIN product p ON p.id = pv."productId" '
        + 'LEFT JOIN product_translation pt ON pt."baseId" = p.id '
        + 'WHERE ol."orderId" = $1 AND COALESCE(p."customFieldsWaimaisoldout", false) = true '
        + 'ORDER BY (pt."languageCode" = \'zh_Hans\') DESC LIMIT 1',
        [orderId],
    );
    const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    const name = list?.[0]?.name;
    return name == null ? null : String(name);
}

export const campusOrderGateProcess: OrderProcess<any> = {
    async onTransitionStart(fromState, toState, { ctx, order }: { ctx: RequestContext; order: any }) {
        if (toState !== 'ArrangingPayment') return;
        const cf = (order.customFields ?? {}) as any;
        const isErrand = cf.orderKind === 'errand';
        // 1) 营业时间（跑腿单是平台跑腿服务，不受商家堂食营业时间约束）
        if (!isErrand) {
            const hours = ((ctx.channel as any)?.customFields ?? {}).waimaiBusinessHours as string | undefined;
            if (hours && !isWithinBusinessHours(hours)) {
                throw new UserInputError(`店铺已打烊（营业时间 ${hours}），暂不可下单`);
            }
        }
        const conn = connRef;
        if (!conn) return;
        // 2) 黑名单
        if (await isBlacklisted(conn, Number(ctx.channelId), Number(order.id))) {
            throw new UserInputError(BLACKLIST_MESSAGE);
        }
        // 3) 沽清
        const soldOut = await findSoldOutProductName(conn, Number(order.id));
        if (soldOut) {
            throw new UserInputError(`商品「${soldOut}」今日已售完，请重新选择`);
        }
        // 4) 每日限量 / 每人限购（额度按 UTC+8 当日已支付订单统计，本单不计入）
        const limitHit = await findDailyLimitViolation(conn, Number(ctx.channelId), Number(order.id));
        if (limitHit) {
            throw new UserInputError(limitHit);
        }
    },
};
