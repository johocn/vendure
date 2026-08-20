import { LanguageCode, PromotionItemAction, RequestContext } from '@vendure/core';

import { flashSaleDiscountCondition } from './flash-sale-promotion-condition';

/**
 * 秒杀价覆盖 Action。
 *
 * 配套 flashSaleDiscountCondition：condition 在结算期动态查活动返回
 * `{ variantId, flashPrice }` 作为 state，此 action 读 state 命中秒杀变体行后，
 * 把单价从原价下调至秒杀价（折扣 = unitPrice - flashPrice，>0 才折让）。
 *
 * execute 返回的是 OrderLine 单价应被扣减的金额（负数），
 * 由 PromotionItemAction 框架按数量累计应用到 OrderLine 上。
 */
export const flashSalePriceAction = new PromotionItemAction({
    code: 'flash_sale_price',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '秒杀价覆盖（订单行单价改为秒杀价）' },
        { languageCode: LanguageCode.en, value: 'Override order line unit price with flash sale price' },
    ],
    args: {},
    conditions: [flashSaleDiscountCondition] as any,
    async execute(ctx: RequestContext, orderLine: any, _args, state): Promise<number> {
        const s = (state as any)?.flash_sale_discount as
            | { variantId: string; flashPrice: number }
            | undefined;
        if (!s?.flashPrice || String(orderLine.productVariant?.id) !== s.variantId) return 0;

        const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
        const delta = unitPrice - s.flashPrice;
        // 单价本就低于秒杀价时不下调，避免负向加价
        if (delta <= 0) return 0;
        return -delta;
    },
});