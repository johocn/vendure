import { INestApplication } from '@nestjs/common';
import { ChannelService, RequestContext } from '@vendure/core';
import { MemberLevelService } from '@vendure/member-level-plugin';

import { withCtx, createAdminCtx } from './shared';

/**
 * 会员等级档位权益播种（阶段39）：为默认渠道配置各档位专属折扣率。
 * specialDiscountRate 语义为「折扣千分比」（100 = 9折/10%优惠，非"950"）。
 * 金卡95折 → 50，白金9折 → 100，钻石8.5折 → 150；普通/银卡无专属折扣(0)。
 */
export const MEMBER_TIER_SOURCES = [
    { tierLevel: 1, threshold: 0, name: '普通会员', pointsMultiplier: 1000, redeemDiscountRate: 1000, redeemCapRatio: 500, specialDiscountRate: 0 },
    { tierLevel: 2, threshold: 1000, name: '银卡会员', pointsMultiplier: 1000, redeemDiscountRate: 1000, redeemCapRatio: 500, specialDiscountRate: 0 },
    { tierLevel: 3, threshold: 5000, name: '金卡会员', pointsMultiplier: 1200, redeemDiscountRate: 1500, redeemCapRatio: 600, specialDiscountRate: 50 },
    { tierLevel: 4, threshold: 20000, name: '白金会员', pointsMultiplier: 1500, redeemDiscountRate: 2000, redeemCapRatio: 800, specialDiscountRate: 100 },
    { tierLevel: 5, threshold: 100000, name: '钻石会员', pointsMultiplier: 2000, redeemDiscountRate: 3000, redeemCapRatio: 1000, specialDiscountRate: 150 },
];

export async function populateMemberTiers(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();
    const memberLevelService = app.get(MemberLevelService);
    await withCtx(app, defaultChannel, async (ctx: RequestContext) => {
        await memberLevelService.saveMemberTiers(ctx, MEMBER_TIER_SOURCES);
    });
}