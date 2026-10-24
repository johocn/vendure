import { Customer, ID, LanguageCode, Order, ShippingCalculator, TransactionalConnection } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { parseDynamicPricing, quoteDynamicFee } from './dynamic-pricing';

/**
 * 校园单运费 calculator：R5 跑腿单固定起步价（errandBaseFee）+ R1/R3 分区运费（zone.fee）。
 * 适用：R5 跑腿单（orderKind='errand'）+ R1/R3 外卖单（fulfillmentRoute，plan2 §Task6/7 结算链路
 * 「campus-zone-fee-calculator 出分区运费」即由此实现）。其他单返回 undefined
 * （vendure 视为该方法不适用，不影响普通订单现有运费）。
 *
 * fork 实测签名：CalculateShippingFn = (ctx, order, args, method)，返回
 * ShippingCalculationResult { price, priceIncludesTax, taxRate, metadata? } | undefined。
 * 渠道取 ctx.channelId（Order 无标量 channelId 列）；zone 按名字匹配本渠道分区，
 * 匹配不到兜底渠道第一个分区；渠道无分区时不计运费（undefined）。
 *
 * 动态计价（2026-10-23）：分区基价 + 时段高峰 + 供需（大厅积压）+ 手动倍率，单笔封顶；
 * 满额免配送费优先（达标直接 0）。只影响结算时实时报价，已支付订单运费不变。
 *
 * connection 由 plugin onApplicationBootstrap 注入（calculate 闭包无 injector 可用）。
 */
let connectionRef: TransactionalConnection | null = null;

export function bindCampusErrandCalculatorConnection(conn: TransactionalConnection) {
    connectionRef = conn;
}

/** 供需因子：大厅积压单量，按渠道缓存 30s（结算页会连续多次调用 calculator） */
const backlogCache = new Map<string, { at: number; value: number }>();
const BACKLOG_TTL = 30_000;

/** 大厅待抢单量（30s 缓存）；动态计价预览与运费报价共用同一口径 */
export async function readHallBacklog(conn: TransactionalConnection, channelId: ID): Promise<number> {
    const key = String(channelId);
    const hit = backlogCache.get(key);
    if (hit && Date.now() - hit.at < BACKLOG_TTL) return hit.value;
    try {
        const value = await conn.rawConnection
            .getRepository(Order)
            .createQueryBuilder('order')
            .innerJoin('order.channels', 'channel', 'channel.id = :cid', { cid: channelId })
            .where('order.customFields.hallStatus = :open', { open: 'open' })
            .andWhere('order.state != :cancelled', { cancelled: 'Cancelled' })
            .getCount();
        backlogCache.set(key, { at: Date.now(), value });
        return value;
    } catch {
        return 0;
    }
}

/** 在线骑手数（approved 且 5min 内有心跳，同 CapacityService.listOnlineRiders 口径）；30s 缓存。
 * 供需加价必须带这个数：不传时 quoteDynamicFee 按 0 处理，riderThreshold 永不生效、骑手充足也会加价。 */
const onlineRiderCache = new Map<string, { at: number; value: number }>();
export async function readOnlineRiderCount(conn: TransactionalConnection, channelId: ID): Promise<number> {
    const key = String(channelId);
    const hit = onlineRiderCache.get(key);
    if (hit && Date.now() - hit.at < BACKLOG_TTL) return hit.value;
    try {
        const value = await conn.rawConnection
            .getRepository(Customer)
            .createQueryBuilder('customer')
            .leftJoin('customer.channels', 'channel')
            .where('channel.id = :cid', { cid: channelId })
            .andWhere('customer.customFields.riderStatus = :status', { status: 'approved' })
            .andWhere('customer.customFields.riderOnlineAt >= :since', { since: new Date(Date.now() - 5 * 60_000) })
            .getCount();
        onlineRiderCache.set(key, { at: Date.now(), value });
        return value;
    } catch {
        return 0;
    }
}

export const campusErrandCalculator = new ShippingCalculator({
    code: 'campus-errand-calculator',
    description: [{ languageCode: LanguageCode.zh, value: '校园配送分区运费' }],
    args: {},
    calculate: async (ctx, order: Order) => {
        const cf = (order.customFields ?? {}) as any;
        const route = cf.fulfillmentRoute;
        const isErrand = cf.orderKind === 'errand';
        if (!isErrand && route !== 'R1' && route !== 'R2' && route !== 'R3') return undefined;
        const conn = connectionRef;
        if (!conn) return undefined;
        const cfg = await conn.rawConnection.getRepository(CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId as any },
        });
        if (isErrand) {
            // R5 跑腿费 = 起步价 errandBaseFee（null=默认 200 分），叠加时段高峰/供需/手动倍率，单笔封顶
            return quoteDynamicBaseFee(conn, ctx.channelId as ID, cfg?.errandBaseFee ?? 200, cfg, 'errand');
        }
        if (route === 'R2') {
            // R2 第三方到校：仅当店铺配置了 thirdPartyBaseFee 才接管顾客侧运费，否则沿用店铺普通快递运费
            const thirdPartyBase = cfg?.thirdPartyBaseFee ?? null;
            if (thirdPartyBase == null || thirdPartyBase <= 0) return undefined;
            return quoteDynamicBaseFee(conn, ctx.channelId as ID, thirdPartyBase, cfg, 'third-party');
        }
        const zones = (await conn.rawConnection.getRepository(CampusZone).find({
            where: { channelId: ctx.channelId as any },
            order: { id: 'ASC' as any },
        })) as Array<CampusZone & { id: ID }>;
        if (!zones.length) return undefined;
        const zone = zones.find(z => z.name === cf.campusZone) ?? zones[0];
        const fee = await quoteZoneFee(conn, ctx.channelId as ID, zone, cfg, order);
        return fee;
    },
});

/** 运费口径：分区配送 / 跑腿起步价 / 第三方到校配基价 */
export type CampusFeeScope = 'zone' | 'errand' | 'third-party';

/**
 * 非分区基价的动态报价（R5 跑腿起步价、R2 第三方到校基价复用）。
 * 满额免配送费不参与（门槛仅针对 R1/R3 外卖单），加价规则与分区运费一致。
 */
export async function quoteDynamicBaseFee(
    conn: TransactionalConnection,
    channelId: ID,
    baseFee: number,
    cfg: CampusFulfillmentConfig | null | undefined,
    scope: Exclude<CampusFeeScope, 'zone'>,
) {
    const pricing = parseDynamicPricing(cfg?.dynamicPricing ?? null);
    const backlog = pricing.enabled && pricing.supply ? await readHallBacklog(conn, channelId) : 0;
    const onlineRiders = pricing.enabled && pricing.supply ? await readOnlineRiderCount(conn, channelId) : 0;
    const quote = quoteDynamicFee({ baseFee, config: pricing, at: new Date(), backlog, onlineRiders });
    return {
        price: quote.price,
        priceIncludesTax: true,
        taxRate: 0,
        metadata: {
            calculator: 'campus-errand',
            scope,
            baseFee: quote.baseFee,
            addFee: quote.addFee,
            breakdown: quote.breakdown,
            pricing: pricing.enabled ? 'dynamic' : 'base-fee',
        },
    };
}

/** C 端结算页分区实时报价：与结算同口径（基价 + 时段/供需/手动倍率，单笔封顶）。
 * 仅用于展示；满免门槛仍由结算侧 quoteZoneFee 判断，避免把「已满免」误显示为加价。 */
export async function quoteZonesForShop(
    conn: TransactionalConnection,
    channelId: ID,
    zones: Array<{ id: any; name: string; fee: number }>,
) {
    const cfg = await conn.rawConnection.getRepository(CampusFulfillmentConfig).findOne({
        where: { channelId: channelId as any },
    });
    const pricing = parseDynamicPricing(cfg?.dynamicPricing ?? null);
    const backlog = pricing.enabled && pricing.supply ? await readHallBacklog(conn, channelId) : 0;
    const onlineRiders = pricing.enabled && pricing.supply ? await readOnlineRiderCount(conn, channelId) : 0;
    const at = new Date();
    return zones.map(z => {
        const q = quoteDynamicFee({ baseFee: Number(z.fee), config: pricing, at, backlog, onlineRiders });
        return {
            ...z,
            fee: Number(z.fee),
            price: q.price,
            addFee: q.addFee,
            breakdown: q.breakdown,
        };
    });
}

/** 分区运费报价（改址差额也复用此函数，保证前后口径一致） */
export async function quoteZoneFee(
    conn: TransactionalConnection,
    channelId: ID,
    zone: { name: string; fee: number },
    cfg: CampusFulfillmentConfig | null | undefined,
    order: { subTotalWithTax?: number; subTotal?: number },
) {
    // 满 X 元免配送费（plan 3.2）：门店级门槛，达标即运费 0（仅 R1/R3 外卖单；跑腿单不参与）
    const threshold = cfg?.freeShippingThreshold ?? null;
    const goods = order.subTotalWithTax ?? order.subTotal ?? 0;
    if (threshold != null && threshold > 0 && goods >= threshold) {
        return {
            price: 0,
            priceIncludesTax: true,
            taxRate: 0,
            metadata: { zoneName: zone.name, calculator: 'campus-errand', freeShipping: true, originalPrice: zone.fee, threshold },
        };
    }
    const pricing = parseDynamicPricing(cfg?.dynamicPricing ?? null);
    const backlog = pricing.enabled && pricing.supply ? await readHallBacklog(conn, channelId) : 0;
    const onlineRiders = pricing.enabled && pricing.supply ? await readOnlineRiderCount(conn, channelId) : 0;
    const quote = quoteDynamicFee({ baseFee: zone.fee, config: pricing, at: new Date(), backlog, onlineRiders });
    return {
        price: quote.price,
        priceIncludesTax: true,
        taxRate: 0,
        metadata: {
            zoneName: zone.name,
            calculator: 'campus-errand',
            baseFee: quote.baseFee,
            addFee: quote.addFee,
            breakdown: quote.breakdown,
            pricing: pricing.enabled ? 'dynamic' : 'zone-fee',
        },
    };
}
