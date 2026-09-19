import { Customer, Order, RequestContext, TransactionalConnection } from '@vendure/core';

import { CouponBindingService } from './coupon-binding.service';
import { getCouponConnection } from './coupon-runtime';

/**
 * 结算期需要访问商品绑券服务与订单历史统计。
 * Promotion 条件在结算同步路径里无法走 Nest 注入，照 coupon-runtime 的单例注入模式，
 * 在插件 onApplicationBootstrap 时注入。
 */
let bindingService: CouponBindingService | undefined;

export function setBindingService(svc: CouponBindingService): void {
    bindingService = svc;
}

export function getBindingService(): CouponBindingService {
    if (!bindingService) {
        throw new Error('CouponPlugin CouponBindingService not initialized');
    }
    return bindingService;
}

/**
 * 新客判定（统一口径）：本租户（channelId）无历史有效订单。
 * 有效订单排除未完成/取消态；跨渠道订单不计入。
 * 注意：Order 无 channelId 列，渠道归属经 `o.channels` ManyToMany 关联表过滤。
 */
export async function isNewCustomerWithinChannel(
    ctx: RequestContext,
    customerId: number | undefined | null,
): Promise<boolean> {
    if (customerId == null) return true;
    const count = await getCouponConnection()
        .getRepository(ctx, Order)
        .createQueryBuilder('o')
        .innerJoin('o.channels', 'ch')
        .where('o.customerId = :cid', { cid: customerId })
        .andWhere('ch.id = :chan', { chan: ctx.channelId })
        .andWhere("o.state NOT IN ('Created','AddingItems','ArrangingPayment','Modifying','Cancelled')")
        .getCount();
    return count === 0;
}

/**
 * 新客判定：本租户无历史有效订单（排除创建/购物车/待支付/修改/取消等未完成态）视为新客。
 * customerId 解析顺序：order.customer.id 优先，其次按 activeUserId 反查 Customer；
 * 均解析不到时视为新客。
 */
export async function isNewCustomer(ctx: RequestContext, order: any): Promise<boolean> {
    let customerId: number | undefined = order?.customer?.id as number | undefined;
    if (customerId == null && ctx.activeUserId != null) {
        const cust = await getCouponConnection()
            .getRepository(ctx, Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } } as any);
        customerId = cust?.id as number | undefined;
    }
    return isNewCustomerWithinChannel(ctx, customerId);
}
