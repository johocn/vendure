import { LanguageCode, PromotionItemAction } from '@vendure/core';

// TODO: 仅实现 leaderRewardType=discount（直接扣减金额）。
// cashback（返现，需在订单完成后触发转账）与 free（免单，需整行置零并记录）
// 涉及独立的状态机与副作用，暂留待后续补全。
export const groupBuyLeaderRewardAction = new PromotionItemAction({
    code: 'group_buy_leader_reward',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '拼团团长折扣' },
        { languageCode: LanguageCode.en, value: 'Group buy leader discount' },
    ],
    args: {
        leaderDiscount: {
            type: 'int',
            ui: {
                component: 'currency-form-input',
            },
        },
    },
    async execute(ctx, orderLine, args) {
        return args.leaderDiscount > 0 ? -args.leaderDiscount : 0;
    },
});
