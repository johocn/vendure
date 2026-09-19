import { RequestContext } from '@vendure/core';
import { CouponBindingService } from './coupon-binding.service';
export declare function setBindingService(svc: CouponBindingService): void;
export declare function getBindingService(): CouponBindingService;
/**
 * 新客判定（统一口径）：本租户（channelId）无历史有效订单。
 * 有效订单排除未完成/取消态；跨渠道订单不计入。
 * 注意：Order 无 channelId 列，渠道归属经 `o.channels` ManyToMany 关联表过滤。
 */
export declare function isNewCustomerWithinChannel(ctx: RequestContext, customerId: number | undefined | null): Promise<boolean>;
/**
 * 新客判定：本租户无历史有效订单（排除创建/购物车/待支付/修改/取消等未完成态）视为新客。
 * customerId 解析顺序：order.customer.id 优先，其次按 activeUserId 反查 Customer；
 * 均解析不到时视为新客。
 */
export declare function isNewCustomer(ctx: RequestContext, order: any): Promise<boolean>;
