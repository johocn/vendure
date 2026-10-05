import { ID, LanguageCode, Order, ShippingCalculator, TransactionalConnection } from '@vendure/core';
import { CampusZone } from './campus-zone.entity';

/**
 * 校园单分区运费 calculator：shipping = 所在分区 zone.fee。
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
let connectionRef: TransactionalConnection | null = null;

export function bindCampusErrandCalculatorConnection(conn: TransactionalConnection) {
    connectionRef = conn;
}

export const campusErrandCalculator = new ShippingCalculator({
    code: 'campus-errand-calculator',
    description: [{ languageCode: LanguageCode.zh, value: '校园配送分区运费' }],
    args: {},
    calculate: async (ctx, order: Order) => {
        const cf = (order.customFields ?? {}) as any;
        const route = cf.fulfillmentRoute;
        if (cf.orderKind !== 'errand' && route !== 'R1' && route !== 'R3') return undefined;
        const conn = connectionRef;
        if (!conn) return undefined;
        const zones = (await conn.rawConnection.getRepository(CampusZone).find({
            where: { channelId: ctx.channelId as any },
            order: { id: 'ASC' as any },
        })) as Array<CampusZone & { id: ID }>;
        if (!zones.length) return undefined;
        const zone = zones.find(z => z.name === cf.campusZone) ?? zones[0];
        return {
            price: zone.fee,
            priceIncludesTax: true,
            taxRate: 0,
            metadata: { zoneName: zone.name, calculator: 'campus-errand' },
        };
    },
});
