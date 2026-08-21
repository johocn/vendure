"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preSalePriceAction = void 0;
const core_1 = require("@vendure/core");
const pre_sale_promotion_condition_1 = require("./pre-sale-promotion-condition");
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
exports.preSalePriceAction = new core_1.PromotionItemAction({
    code: 'pre_sale_price',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '预售价覆盖（订单行单价改为预售价）' },
        { languageCode: core_1.LanguageCode.en, value: 'Override order line unit price with pre-sale price' },
    ],
    args: {},
    conditions: [pre_sale_promotion_condition_1.preSaleDiscountCondition],
    async execute(ctx, orderLine, _args, state) {
        var _a;
        const s = state === null || state === void 0 ? void 0 : state.pre_sale_discount;
        if (!(s === null || s === void 0 ? void 0 : s.usePresale) || !(s.presalePrice > 0))
            return 0;
        if (String((_a = orderLine.productVariant) === null || _a === void 0 ? void 0 : _a.id) !== s.variantId)
            return 0;
        const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
        const delta = unitPrice - s.presalePrice;
        // 单价本就低于预售价时不下调，避免负向加价
        if (delta <= 0)
            return 0;
        return -delta;
    },
});
//# sourceMappingURL=pre-sale-price-action.js.map