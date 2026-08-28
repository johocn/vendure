import { INestApplication } from '@nestjs/common';
import { ChannelService, RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponService, CouponTemplate } from '@vendure/coupon-plugin';

import { withCtx } from './shared';
import { GLOBAL_COUPONS } from './sources';

/**
 * 旧全局券数据（CouponSource）→ 新版券模板（CouponTemplate）字段映射：
 * - couponType: 'fixed' | 'percentage' → type: 'FIXED' | 'PERCENT'
 * - percentage 语义差异：旧数据 discountValue 表示「优惠百分比」（10=9折），
 *   新插件 PERCENT 表示「折扣折数」（90=9折），故换算 100 - discountValue。
 * - maxDiscount / isNewUserOnly / isGlobal 在新模板体系无对应字段，忽略。
 */
function toCouponType(t: 'fixed' | 'percentage'): 'FIXED' | 'PERCENT' {
    return t === 'fixed' ? 'FIXED' : 'PERCENT';
}

function toDiscountValue(t: 'fixed' | 'percentage', v: number): number {
    return t === 'percentage' ? 100 - v : v;
}

export async function populateCoupons(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const conn = app.get(TransactionalConnection);
    const defaultChannel = await channelService.getDefaultChannel();
    const repo = conn.rawConnection.getRepository(CouponTemplate);

    await withCtx(app, defaultChannel, async (ctx: RequestContext) => {
        const couponService = app.get(CouponService);

        for (const c of GLOBAL_COUPONS) {
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
                existing.scope = templateData.scope as any;
                await repo.save(existing);
                console.log(`  更新全局优惠券: ${c.name}`);
            } else {
                // 通过 service 创建（自动处理 channels 关系）
                await couponService.createTemplate(ctx, templateData);
                console.log(`  创建全局优惠券: ${c.name}`);
            }
        }
    });
}
