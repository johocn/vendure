import { RequestContext } from '@vendure/core';
import { CouponBindingService } from './coupon-binding.service';
export declare function setBindingService(svc: CouponBindingService): void;
export declare function getBindingService(): CouponBindingService;
/**
 * 新客判定：本租户无历史有效订单（排除创建/购物车/待支付/修改/取消等未完成态）视为新客。
 * customerId 解析顺序：order.customer.id 优先，其次按 activeUserId 反查 Customer；
 * 均解析不到时视为新客。
 */
export declare function isNewCustomer(ctx: RequestContext, order: any): Promise<boolean>;
