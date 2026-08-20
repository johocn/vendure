import { PromotionCondition } from '@vendure/core';
import { GroupBuyLeaderRewardConditionState } from './types';
/**
 * 拼团团长奖励条件：订单为团长拼团单（isGroupBuyLeader）且活动存在、
 * 奖励类型为 discount 且有面额时，返回 state `{ variantId, leaderDiscount }` 供配套动作取折扣。
 */
export declare const groupBuyLeaderRewardCondition: PromotionCondition<{}, "group_buy_leader_reward", false | GroupBuyLeaderRewardConditionState>;
