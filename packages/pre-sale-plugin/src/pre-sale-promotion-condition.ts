import { LanguageCode, PromotionCondition, RequestContext } from '@vendure/core';

import { PreSaleActivity } from './pre-sale-activity.entity';
import { getPreSaleConnection } from './pre-sale-runtime';

/**
 * 预售价条件：读 order.customFields.preSaleActivityId，
 * 运行时查询活动并校验（存在、非 ended、窗口内、库存未售罄）后，
 * 返回 state `{ variantId, presalePrice, usePresale }` 供 pre_sale_price 动作取价。
 *
 * 与阶段14/15 一致：活动配置运行时动态读取，无需在管理端按活动手工配 args。
 */
export const preSaleDiscountCondition = new PromotionCondition({
    code: 'pre_sale_discount',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '预售优惠' },
        { languageCode: LanguageCode.en, value: 'Pre-sale Discount' },
    ],
    args: {},
    async check(ctx: RequestContext, order: any) {
        const activityId = order?.customFields?.preSaleActivityId;
        if (activityId == null) return false;

        const activity = await getPreSaleConnection()
            .getRepository(ctx, PreSaleActivity)
            .findOne({ where: { id: activityId as any } });
        if (!activity) return false;

        const now = new Date();
        // active / delivered（到货但仍在锁定价窗口内）都享预售价；ended 不再优惠
        if (activity.status !== 'active' && activity.status !== 'delivered') return false;
        if (activity.startAt && now < activity.startAt) return false;
        if (activity.endAt && now > activity.endAt) return false;
        // 库存售罄不再优惠（存量已占满）
        if (activity.soldCount >= activity.totalStock) return false;
        // 无价格分档（presalePrice<=0）不套价
        if (!(activity.presalePrice > 0)) return false;

        // 订单须包含预售变体行，避免对非预售商品误打折
        const lines = order?.lines ?? [];
        const hasVariant = lines.some(
            (l: any) => l?.productVariant && String(l.productVariant.id) === String(activity.variantId),
        );
        if (!hasVariant) return false;

        return {
            variantId: String(activity.variantId),
            presalePrice: activity.presalePrice,
            usePresale: true,
        };
    },
    priorityValue: 900,
});