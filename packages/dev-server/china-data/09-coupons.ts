import { INestApplication } from '@nestjs/common';
import { ChannelService, RequestContext, TransactionalConnection } from '@vendure/core';
import { Coupon, CouponService } from '@vendure/coupon-plugin';

import { withCtx } from './shared';
import { GLOBAL_COUPONS } from './sources';

export async function populateCoupons(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const conn = app.get(TransactionalConnection);
    const defaultChannel = await channelService.getDefaultChannel();
    const repo = conn.rawConnection.getRepository(Coupon);

    await withCtx(app, defaultChannel, async (ctx: RequestContext) => {
        const couponService = app.get(CouponService);

        for (const c of GLOBAL_COUPONS) {
            // 幂等：检查同 name 的全局券是否已存在
            const existing = await repo.findOne({
                where: { name: c.name, isGlobal: true },
            });

            if (existing) {
                // 更新已有券
                existing.description = c.description;
                existing.minSpend = c.minSpend;
                existing.maxDiscount = c.maxDiscount;
                existing.startAt = new Date(c.startAt);
                existing.endAt = new Date(c.endAt);
                existing.totalQuantity = c.totalQuantity;
                existing.limitPerUser = c.limitPerUser;
                existing.isActive = c.isActive;
                existing.isNewUserOnly = c.isNewUserOnly;
                await repo.save(existing);
                console.log(`  更新全局优惠券: ${c.name}`);
            } else {
                // 通过 service 创建（自动处理 channels 关系 + ownerChannelId）
                await couponService.createCoupon(ctx, {
                    name: c.name,
                    description: c.description,
                    couponType: c.couponType,
                    discountValue: c.discountValue,
                    minSpend: c.minSpend,
                    maxDiscount: c.maxDiscount,
                    startAt: new Date(c.startAt),
                    endAt: new Date(c.endAt),
                    totalQuantity: c.totalQuantity,
                    limitPerUser: c.limitPerUser,
                    isActive: c.isActive,
                    isNewUserOnly: c.isNewUserOnly,
                    isGlobal: c.isGlobal,
                });
                console.log(`  创建全局优惠券: ${c.name}`);
            }
        }
    });
}
