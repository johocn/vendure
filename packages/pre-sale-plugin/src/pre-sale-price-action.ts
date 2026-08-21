import { LanguageCode, PromotionItemAction, RequestContext } from '@vendure/core';

import { preSaleDiscountCondition } from './pre-sale-promotion-condition';

/**
 * 预售价覆盖 Action。
 *
 * 配套 preSaleDiscountCondition：condition 在结算期动态查活动返回
 * `{ variantId, presalePrice, usePresale }` 作为 state，此 action 读 state
 * 命中预售变体行后，把单价从原价下调至预售价（折扣 = unitPrice - presalePrice，>0 才折让）。
 *
 * execute 返回的是 OrderLine 单价应被扣减的金额（负数），
 * 由 PromotionItemAction 框架按数量累计应用到 OrderLine 上。
 */
export const preSalePriceAction = new PromotionItemAction({
    code: 'pre_sale_price',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '预售价覆盖（订单行单价改为预售价）' },
        { languageCode: LanguageCode.en, value: 'Override order line unit price with pre-sale price' },
    ],
    args: {},
    conditions: [preSaleDiscountCondition] as any,
    async execute(ctx: RequestContext, orderLine: any, _args, state): Promise<number> {
        const s = (state as any)?.pre_sale_discount as
            | { variantId: string; presalePrice: number; usePresale: boolean }
            | undefined;
        if (!s?.usePresale || !(s.presalePrice > 0)) return 0;
        if (String(orderLine.productVariant?.id) !== s.variantId) return 0;

        const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
        const delta = unitPrice - s.presalePrice;
        // 单价本就低于预售价时不下调，避免负向加价
        if (delta <= 0) return 0;
        return -delta;
    },
});