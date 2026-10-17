"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEMBER_TIER_SOURCES = void 0;
exports.populateMemberTiers = populateMemberTiers;
const core_1 = require("@vendure/core");
const member_level_plugin_1 = require("@vendure/member-level-plugin");
const shared_1 = require("./shared");
/**
 * 会员等级档位权益播种（阶段39）：为默认渠道配置各档位专属折扣率。
 * specialDiscountRate 语义为「折扣千分比」（100 = 9折/10%优惠，非"950"）。
 * 金卡95折 → 50，白金9折 → 100，钻石8.5折 → 150；普通/银卡无专属折扣(0)。
 */
exports.MEMBER_TIER_SOURCES = [
    { tierLevel: 1, threshold: 0, name: '普通会员', pointsMultiplier: 1000, redeemDiscountRate: 1000, redeemCapRatio: 500, specialDiscountRate: 0 },
    { tierLevel: 2, threshold: 1000, name: '银卡会员', pointsMultiplier: 1000, redeemDiscountRate: 1000, redeemCapRatio: 500, specialDiscountRate: 0 },
    { tierLevel: 3, threshold: 5000, name: '金卡会员', pointsMultiplier: 1200, redeemDiscountRate: 1500, redeemCapRatio: 600, specialDiscountRate: 50 },
    { tierLevel: 4, threshold: 20000, name: '白金会员', pointsMultiplier: 1500, redeemDiscountRate: 2000, redeemCapRatio: 800, specialDiscountRate: 100 },
    { tierLevel: 5, threshold: 100000, name: '钻石会员', pointsMultiplier: 2000, redeemDiscountRate: 3000, redeemCapRatio: 1000, specialDiscountRate: 150 },
];
async function populateMemberTiers(app) {
    const channelService = app.get(core_1.ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();
    const memberLevelService = app.get(member_level_plugin_1.MemberLevelService);
    await (0, shared_1.withCtx)(app, defaultChannel, async (ctx) => {
        await memberLevelService.saveMemberTiers(ctx, exports.MEMBER_TIER_SOURCES);
    });
}
//# sourceMappingURL=10-member-tiers.js.map