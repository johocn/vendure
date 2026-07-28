"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupBuyPriceAction = void 0;
const core_1 = require("@vendure/core");
exports.groupBuyPriceAction = new core_1.PromotionItemAction({
    code: 'group_buy_price',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '拼团价' },
        { languageCode: core_1.LanguageCode.en, value: 'Group buy price' },
    ],
    args: {
        groupPrice: {
            type: 'int',
            ui: {
                component: 'currency-form-input',
            },
        },
    },
    async execute(ctx, orderLine, args) {
        const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
        const delta = unitPrice - args.groupPrice;
        return delta > 0 ? -delta : 0;
    },
});
//# sourceMappingURL=group-buy-price-action.js.map