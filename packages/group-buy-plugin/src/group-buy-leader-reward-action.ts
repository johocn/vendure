import { LanguageCode, PromotionItemAction, RequestContext } from '@vendure/core';

import { GroupBuyLeaderRewardConditionState } from './types';
import { groupBuyLeaderRewardCondition } from './group-buy-leader-promotion';

/**
 * 拼团团长折扣动作：依赖 group_buy_leader_reward 条件（条件已把 leaderDiscount 放入 state）。
 * 仅对命中拼团变体的行折让 leaderDiscount（PromotionItemAction 返回值须为负数）。
 *
 * TODO: leaderRewardType=cashback（返现）与 free（免单）涉及独立状态机与副作用，暂留待后续。
 */
export const groupBuyLeaderRewardAction = new PromotionItemAction<any>({
    code: 'group_buy_leader_reward',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '拼团团长折扣' },
        { languageCode: LanguageCode.en, value: 'Group buy leader discount' },
    ],
    args: {},
    conditions: [groupBuyLeaderRewardCondition] as any,
    async execute(ctx: RequestContext, orderLine: any, _args, state): Promise<number> {
        // state 按条件 code 嵌套：state = { group_buy_leader_reward: { leaderDiscount, variantId } }
        const s = (state as any)?.group_buy_leader_reward as GroupBuyLeaderRewardConditionState | undefined;
        if (!s?.leaderDiscount) return 0;
        if (!orderLine?.productVariant || String(orderLine.productVariant.id) !== String(s.variantId)) {
            return 0;
        }
        return -s.leaderDiscount;
    },
});
