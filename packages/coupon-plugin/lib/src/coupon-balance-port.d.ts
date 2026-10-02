import { RequestContext } from '@vendure/core';
/**
 * 余额能力端口：由 `recharge-card-plugin` 在启动时通过 setCouponBalancePort 可选注册。
 * coupon-plugin 不直接依赖其内部实现，未注册时余额相关入口一律报「余额支付不可用」。
 */
export interface CouponBalancePort {
    getBalance(ctx: RequestContext, customerId: number): Promise<number>;
    /** 扣减余额（不足时抛 UserInputError） */
    deductBalance(ctx: RequestContext, customerId: number, amount: number): Promise<number>;
    /** 增加余额（退款补偿用） */
    addBalance(ctx: RequestContext, customerId: number, amount: number): Promise<number>;
}
export declare function setCouponBalancePort(p: CouponBalancePort | null): void;
export declare function getCouponBalancePort(): CouponBalancePort | null;
