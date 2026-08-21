import { LanguageCode, Order, ShippingCalculator, TransactionalConnection } from '@vendure/core';

import { computeShopFees } from './shipping-rules';

/** init 注入的连接（供按店读取运费档位）。 */
let connection: TransactionalConnection | undefined;

/**
 * 按店运费计价：读订单行 → 商品所属 ShopId 反查，按店聚合小计，
 * 每店读取 DeliveryRange.baseFee / freeThreshold：小计 ≥ freeThreshold 即包邮(0)，否则收 baseFee。
 * 合计为订单运费；明细写入 metadata.shops 供前端「运费明细」展示。
 */
export const rangeShippingCalculator = new ShippingCalculator({
    code: 'range-shipping',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '按店运费（基础运费 / 满额包邮）' },
        { languageCode: LanguageCode.en, value: 'Per-Shop Range Shipping Calculator' },
    ],
    args: {},
    init(injector) {
        connection = injector.get(TransactionalConnection);
    },
    calculate: async (ctx, order, args) => {
        if (!connection || !order || !(order.lines?.length ?? 0)) {
            return { price: 0, priceIncludesTax: true, taxRate: 0 };
        }
        const fees = await computeShopFees(connection, ctx, order);
        const total = fees.reduce((sum, f) => sum + f.fee, 0);
        return {
            price: total,
            priceIncludesTax: true,
            taxRate: 0,
            metadata: { shops: fees },
        };
    },
});