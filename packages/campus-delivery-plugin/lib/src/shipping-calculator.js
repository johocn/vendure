"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusErrandCalculator = void 0;
exports.bindCampusErrandCalculatorConnection = bindCampusErrandCalculatorConnection;
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
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
 * connection 由 plugin onApplicationBootstrap 注入（calculate 闭包无 injector 可用）。
 */
let connectionRef = null;
function bindCampusErrandCalculatorConnection(conn) {
    connectionRef = conn;
}
exports.campusErrandCalculator = new core_1.ShippingCalculator({
    code: 'campus-errand-calculator',
    description: [{ languageCode: core_1.LanguageCode.zh, value: '校园配送分区运费' }],
    args: {},
    calculate: async (ctx, order) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        const route = cf.fulfillmentRoute;
        const isErrand = cf.orderKind === 'errand';
        // R2 返回 undefined：快递段运费走店铺普通快递运费（接力费用由 R5 接力单单独承担）
        if (!isErrand && route !== 'R1' && route !== 'R3')
            return undefined;
        const conn = connectionRef;
        if (!conn)
            return undefined;
        if (isErrand) {
            // R5 跑腿费 = 固定起步价 errandBaseFee（后台可配；null=默认 200 分），不按分区
            const cfg = await conn.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
                where: { channelId: ctx.channelId },
            });
            return {
                price: (_b = cfg === null || cfg === void 0 ? void 0 : cfg.errandBaseFee) !== null && _b !== void 0 ? _b : 200,
                priceIncludesTax: true,
                taxRate: 0,
                metadata: { calculator: 'campus-errand', pricing: 'errand-base-fee' },
            };
        }
        const zones = (await conn.rawConnection.getRepository(campus_zone_entity_1.CampusZone).find({
            where: { channelId: ctx.channelId },
            order: { id: 'ASC' },
        }));
        if (!zones.length)
            return undefined;
        const zone = (_c = zones.find(z => z.name === cf.campusZone)) !== null && _c !== void 0 ? _c : zones[0];
        // 满 X 元免配送费（plan 3.2）：门店级门槛，达标即运费 0（仅 R1/R3 外卖单；跑腿单不参与）
        const threshold = (_e = (_d = (await conn.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId },
        }))) === null || _d === void 0 ? void 0 : _d.freeShippingThreshold) !== null && _e !== void 0 ? _e : null;
        const goods = (_g = (_f = order.subTotalWithTax) !== null && _f !== void 0 ? _f : order.subTotal) !== null && _g !== void 0 ? _g : 0;
        if (threshold != null && threshold > 0 && goods >= threshold) {
            return {
                price: 0,
                priceIncludesTax: true,
                taxRate: 0,
                metadata: { zoneName: zone.name, calculator: 'campus-errand', freeShipping: true, originalPrice: zone.fee, threshold },
            };
        }
        return {
            price: zone.fee,
            priceIncludesTax: true,
            taxRate: 0,
            metadata: { zoneName: zone.name, calculator: 'campus-errand' },
        };
    },
});
//# sourceMappingURL=shipping-calculator.js.map