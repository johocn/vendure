import { PromotionItemAction } from '@vendure/core';
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
export declare const flashSalePriceAction: PromotionItemAction<{
    flashPrice: {
        type: "int";
        defaultValue: number;
        ui: {
            component: string;
        };
    };
}, []>;
