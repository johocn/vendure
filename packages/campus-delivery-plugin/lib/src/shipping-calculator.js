"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusErrandCalculator = void 0;
exports.bindCampusErrandCalculatorConnection = bindCampusErrandCalculatorConnection;
const core_1 = require("@vendure/core");
const campus_zone_entity_1 = require("./campus-zone.entity");
/**
 * R5 跑腿单分区运费 calculator：shipping = 所在分区 zone.fee。
 * 非 errand 单返回 undefined（vendure 视为该方法不适用，不影响普通订单现有运费）。
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
    description: [{ languageCode: core_1.LanguageCode.zh, value: '校园跑腿分区运费' }],
    args: {},
    calculate: async (ctx, order) => {
        var _a, _b;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        if (cf.orderKind !== 'errand')
            return undefined;
        const conn = connectionRef;
        if (!conn)
            return undefined;
        const zones = (await conn.rawConnection.getRepository(campus_zone_entity_1.CampusZone).find({
            where: { channelId: ctx.channelId },
            order: { id: 'ASC' },
        }));
        if (!zones.length)
            return undefined;
        const zone = (_b = zones.find(z => z.name === cf.campusZone)) !== null && _b !== void 0 ? _b : zones[0];
        return {
            price: zone.fee,
            priceIncludesTax: true,
            taxRate: 0,
            metadata: { zoneName: zone.name, calculator: 'campus-errand' },
        };
    },
});
//# sourceMappingURL=shipping-calculator.js.map