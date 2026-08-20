import { PromotionItemAction } from '@vendure/core';
/**
 * 拼团团长折扣动作：依赖 group_buy_leader_reward 条件（条件已把 leaderDiscount 放入 state）。
 * 仅对命中拼团变体的行折让 leaderDiscount（PromotionItemAction 返回值须为负数）。
 *
 * TODO: leaderRewardType=cashback（返现）与 free（免单）涉及独立状态机与副作用，暂留待后续。
 */
export declare const groupBuyLeaderRewardAction: PromotionItemAction<any, []>;
