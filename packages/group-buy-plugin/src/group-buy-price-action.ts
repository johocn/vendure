import { LanguageCode, PromotionItemAction, RequestContext } from '@vendure/core';

import { GroupBuyDiscountConditionState } from './types';
import { groupBuyDiscountCondition } from './group-buy-promotion-condition';

/**
 * 拼团价动作：依赖 group_buy_discount 条件（condition 已把活动 groupPrice 放入 state）。
 * 仅对命中拼团变体的行，按「原价 - 拼团价」折让（PromotionItemAction 返回值须为负数）。
 */
export const groupBuyPriceAction = new PromotionItemAction<any>({
    code: 'group_buy_price',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '拼团价' },
        { languageCode: LanguageCode.en, value: 'Group buy price' },
    ],
    args: {},
    conditions: [groupBuyDiscountCondition] as any,
    async execute(ctx: RequestContext, orderLine: any, _args, state): Promise<number> {
        // Vendure 会把每条 condition 的返回值按 condition.code 归入 state：
        // state = { group_buy_discount: { variantId, groupPrice } }。必须嵌套取。
        const s = (state as any)?.group_buy_discount as GroupBuyDiscountConditionState | undefined;
        if (!s?.groupPrice) return 0;
        if (!orderLine?.productVariant || String(orderLine.productVariant.id) !== String(s.variantId)) {
            return 0;
        }
        const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
        const delta = unitPrice - s.groupPrice;
        return delta > 0 ? -delta : 0;
    },
});
