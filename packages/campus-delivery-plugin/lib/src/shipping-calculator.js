"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusErrandCalculator = void 0;
exports.bindCampusErrandCalculatorConnection = bindCampusErrandCalculatorConnection;
exports.readHallBacklog = readHallBacklog;
exports.quoteDynamicBaseFee = quoteDynamicBaseFee;
exports.quoteZonesForShop = quoteZonesForShop;
exports.quoteZoneFee = quoteZoneFee;
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
const dynamic_pricing_1 = require("./dynamic-pricing");
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
let connectionRef = null;
function bindCampusErrandCalculatorConnection(conn) {
    connectionRef = conn;
}
/** 供需因子：大厅积压单量，按渠道缓存 30s（结算页会连续多次调用 calculator） */
const backlogCache = new Map();
const BACKLOG_TTL = 30000;
/** 大厅待抢单量（30s 缓存）；动态计价预览与运费报价共用同一口径 */
async function readHallBacklog(conn, channelId) {
    const key = String(channelId);
    const hit = backlogCache.get(key);
    if (hit && Date.now() - hit.at < BACKLOG_TTL)
        return hit.value;
    try {
        const value = await conn.rawConnection
            .getRepository(core_1.Order)
            .createQueryBuilder('order')
            .innerJoin('order.channels', 'channel', 'channel.id = :cid', { cid: channelId })
            .where('order.customFields.hallStatus = :open', { open: 'open' })
            .andWhere('order.state != :cancelled', { cancelled: 'Cancelled' })
            .getCount();
        backlogCache.set(key, { at: Date.now(), value });
        return value;
    }
    catch (_a) {
        return 0;
    }
}
exports.campusErrandCalculator = new core_1.ShippingCalculator({
    code: 'campus-errand-calculator',
    description: [{ languageCode: core_1.LanguageCode.zh, value: '校园配送分区运费' }],
    args: {},
    calculate: async (ctx, order) => {
        var _a, _b, _c, _d;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        const route = cf.fulfillmentRoute;
        const isErrand = cf.orderKind === 'errand';
        if (!isErrand && route !== 'R1' && route !== 'R2' && route !== 'R3')
            return undefined;
        const conn = connectionRef;
        if (!conn)
            return undefined;
        const cfg = await conn.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId },
        });
        if (isErrand) {
            // R5 跑腿费 = 起步价 errandBaseFee（null=默认 200 分），叠加时段高峰/供需/手动倍率，单笔封顶
            return quoteDynamicBaseFee(conn, ctx.channelId, (_b = cfg === null || cfg === void 0 ? void 0 : cfg.errandBaseFee) !== null && _b !== void 0 ? _b : 200, cfg, 'errand');
        }
        if (route === 'R2') {
            // R2 第三方到校：仅当店铺配置了 thirdPartyBaseFee 才接管顾客侧运费，否则沿用店铺普通快递运费
            const thirdPartyBase = (_c = cfg === null || cfg === void 0 ? void 0 : cfg.thirdPartyBaseFee) !== null && _c !== void 0 ? _c : null;
            if (thirdPartyBase == null || thirdPartyBase <= 0)
                return undefined;
            return quoteDynamicBaseFee(conn, ctx.channelId, thirdPartyBase, cfg, 'third-party');
        }
        const zones = (await conn.rawConnection.getRepository(campus_zone_entity_1.CampusZone).find({
            where: { channelId: ctx.channelId },
            order: { id: 'ASC' },
        }));
        if (!zones.length)
            return undefined;
        const zone = (_d = zones.find(z => z.name === cf.campusZone)) !== null && _d !== void 0 ? _d : zones[0];
        const fee = await quoteZoneFee(conn, ctx.channelId, zone, cfg, order);
        return fee;
    },
});
/**
 * 非分区基价的动态报价（R5 跑腿起步价、R2 第三方到校基价复用）。
 * 满额免配送费不参与（门槛仅针对 R1/R3 外卖单），加价规则与分区运费一致。
 */
async function quoteDynamicBaseFee(conn, channelId, baseFee, cfg, scope) {
    var _a;
    const pricing = (0, dynamic_pricing_1.parseDynamicPricing)((_a = cfg === null || cfg === void 0 ? void 0 : cfg.dynamicPricing) !== null && _a !== void 0 ? _a : null);
    const backlog = pricing.enabled && pricing.supply ? await readHallBacklog(conn, channelId) : 0;
    const quote = (0, dynamic_pricing_1.quoteDynamicFee)({ baseFee, config: pricing, at: new Date(), backlog });
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
async function quoteZonesForShop(conn, channelId, zones) {
    var _a;
    const cfg = await conn.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
        where: { channelId: channelId },
    });
    const pricing = (0, dynamic_pricing_1.parseDynamicPricing)((_a = cfg === null || cfg === void 0 ? void 0 : cfg.dynamicPricing) !== null && _a !== void 0 ? _a : null);
    const backlog = pricing.enabled && pricing.supply ? await readHallBacklog(conn, channelId) : 0;
    const at = new Date();
    return zones.map(z => {
        const q = (0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: Number(z.fee), config: pricing, at, backlog });
        return Object.assign(Object.assign({}, z), { fee: Number(z.fee), price: q.price, addFee: q.addFee, breakdown: q.breakdown });
    });
}
/** 分区运费报价（改址差额也复用此函数，保证前后口径一致） */
async function quoteZoneFee(conn, channelId, zone, cfg, order) {
    var _a, _b, _c, _d;
    // 满 X 元免配送费（plan 3.2）：门店级门槛，达标即运费 0（仅 R1/R3 外卖单；跑腿单不参与）
    const threshold = (_a = cfg === null || cfg === void 0 ? void 0 : cfg.freeShippingThreshold) !== null && _a !== void 0 ? _a : null;
    const goods = (_c = (_b = order.subTotalWithTax) !== null && _b !== void 0 ? _b : order.subTotal) !== null && _c !== void 0 ? _c : 0;
    if (threshold != null && threshold > 0 && goods >= threshold) {
        return {
            price: 0,
            priceIncludesTax: true,
            taxRate: 0,
            metadata: { zoneName: zone.name, calculator: 'campus-errand', freeShipping: true, originalPrice: zone.fee, threshold },
        };
    }
    const pricing = (0, dynamic_pricing_1.parseDynamicPricing)((_d = cfg === null || cfg === void 0 ? void 0 : cfg.dynamicPricing) !== null && _d !== void 0 ? _d : null);
    const backlog = pricing.enabled && pricing.supply ? await readHallBacklog(conn, channelId) : 0;
    const quote = (0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: zone.fee, config: pricing, at: new Date(), backlog });
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
//# sourceMappingURL=shipping-calculator.js.map