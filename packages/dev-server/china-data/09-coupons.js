"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateCoupons = populateCoupons;
const core_1 = require("@vendure/core");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const shared_1 = require("./shared");
const sources_1 = require("./sources");
/**
 * 旧全局券数据（CouponSource）→ 新版券模板（CouponTemplate）字段映射：
 * - couponType: 'fixed' | 'percentage' → type: 'FIXED' | 'PERCENT'
 * - percentage 语义差异：旧数据 discountValue 表示「优惠百分比」（10=9折），
 *   新插件 PERCENT 表示「折扣折数」（90=9折），故换算 100 - discountValue。
 * - maxDiscount / isNewUserOnly / isGlobal 在新模板体系无对应字段，忽略。
 */
function toCouponType(t) {
    return t === 'fixed' ? 'FIXED' : 'PERCENT';
}
function toDiscountValue(t, v) {
    return t === 'percentage' ? 100 - v : v;
}
async function populateCoupons(app) {
    const channelService = app.get(core_1.ChannelService);
    const conn = app.get(core_1.TransactionalConnection);
    const defaultChannel = await channelService.getDefaultChannel();
    const repo = conn.rawConnection.getRepository(coupon_plugin_1.CouponTemplate);
    await (0, shared_1.withCtx)(app, defaultChannel, async (ctx) => {
        const couponService = app.get(coupon_plugin_1.CouponService);
        for (const c of sources_1.GLOBAL_COUPONS) {
            // 幂等：检查同 name 的券模板是否已存在（默认渠道全局券）
            const existing = await repo.findOne({
                where: { name: c.name },
            });
            const templateData = {
                name: c.name,
                type: toCouponType(c.couponType),
                discountValue: toDiscountValue(c.couponType, c.discountValue),
                minSpend: c.minSpend,
                startsAt: new Date(c.startAt),
                endsAt: new Date(c.endAt),
                totalCount: c.totalQuantity,
                perUserLimit: c.limitPerUser,
                enabled: c.isActive,
                scope: 'ALL',
            };
            if (existing) {
                // 更新已有模板
                existing.type = templateData.type;
                existing.discountValue = templateData.discountValue;
                existing.minSpend = templateData.minSpend;
                existing.startsAt = templateData.startsAt;
                existing.endsAt = templateData.endsAt;
                existing.totalCount = templateData.totalCount;
                existing.perUserLimit = templateData.perUserLimit;
                existing.enabled = templateData.enabled;
                existing.scope = templateData.scope;
                await repo.save(existing);
                console.log(`  更新全局优惠券: ${c.name}`);
            }
            else {
                // 通过 service 创建（自动处理 channels 关系）
                await couponService.createTemplate(ctx, templateData);
                console.log(`  创建全局优惠券: ${c.name}`);
            }
        }
    });
}
//# sourceMappingURL=09-coupons.js.map