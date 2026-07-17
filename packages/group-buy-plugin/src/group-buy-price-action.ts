import { LanguageCode, PromotionItemAction } from '@vendure/core';

export const groupBuyPriceAction = new PromotionItemAction({
    code: 'group_buy_price',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '拼团价' },
        { languageCode: LanguageCode.en, value: 'Group buy price' },
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
