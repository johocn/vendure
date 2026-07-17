import { LanguageCode, PromotionItemAction } from '@vendure/core';

/**
 * 秒杀价覆盖 Action。
 *
 * 配套 flashSaleDiscountCondition 使用：当 order.customFields.flashSaleActivityId 存在时，
 * 该 Action 将订单行单价从原价下调至 args.flashPrice。
 *
 * execute 返回的是 OrderLine 单价应被扣减的金额（负数），
 * 由 PromotionItemAction 框架按数量累计应用到 OrderLine 上。
 *
 * 参考 core 的 products_percentage_discount / order_line_fixed_discount 实现。
 */
export const flashSalePriceAction = new PromotionItemAction({
    code: 'flash_sale_price',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '秒杀价覆盖（订单行单价改为秒杀价）' },
        { languageCode: LanguageCode.en, value: 'Override order line unit price with flash sale price' },
    ],
    args: {
        flashPrice: {
            type: 'int',
            defaultValue: 0,
            ui: {
                component: 'currency-form-input',
            },
        },
    },
    execute(ctx, orderLine, args) {
        const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice;
        const discount = unitPrice - args.flashPrice;
        // 单价本就低于秒杀价时不下调，避免负向加价
        if (discount <= 0) {
            return 0;
        }
        return -discount;
    },
});
