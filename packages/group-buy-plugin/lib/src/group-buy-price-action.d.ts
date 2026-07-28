import { PromotionItemAction } from '@vendure/core';
export declare const groupBuyPriceAction: PromotionItemAction<{
    groupPrice: {
        type: "int";
        ui: {
            component: string;
        };
    };
}, []>;
