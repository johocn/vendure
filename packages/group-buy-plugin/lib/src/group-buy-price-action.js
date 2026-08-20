"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupBuyPriceAction = void 0;
const core_1 = require("@vendure/core");
const group_buy_promotion_condition_1 = require("./group-buy-promotion-condition");
/**
 * 拼团价动作：依赖 group_buy_discount 条件（condition 已把活动 groupPrice 放入 state）。
 * 仅对命中拼团变体的行，按「原价 - 拼团价」折让（PromotionItemAction 返回值须为负数）。
 */
exports.groupBuyPriceAction = new core_1.PromotionItemAction({
    code: 'group_buy_price',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '拼团价' },
        { languageCode: core_1.LanguageCode.en, value: 'Group buy price' },
    ],
    args: {},
    conditions: [group_buy_promotion_condition_1.groupBuyDiscountCondition],
    async execute(ctx, orderLine, _args, state) {
        // Vendure 会把每条 condition 的返回值按 condition.code 归入 state：
        // state = { group_buy_discount: { variantId, groupPrice } }。必须嵌套取。
        const s = state === null || state === void 0 ? void 0 : state.group_buy_discount;
        if (!(s === null || s === void 0 ? void 0 : s.groupPrice))
            return 0;
        if (!(orderLine === null || orderLine === void 0 ? void 0 : orderLine.productVariant) || String(orderLine.productVariant.id) !== String(s.variantId)) {
            return 0;
        }
        const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
        const delta = unitPrice - s.groupPrice;
        return delta > 0 ? -delta : 0;
    },
});
//# sourceMappingURL=group-buy-price-action.js.map