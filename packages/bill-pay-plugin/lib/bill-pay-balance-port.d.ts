/**
 * 余额能力端口（可选依赖 recharge-card-plugin）：
 * 由 plugin.ts 启动时探测注册；未装载 recharge-card 时为 null，余额支付入口不可用。
 * 与 coupon-plugin/coupon-balance-port.ts 同模式（复制不共享，P0 不改 coupon-plugin）。
 */
export interface BillPayBalancePort {
    getBalance(ctx: any, customerId: number): Promise<any>;
    deductBalance(ctx: any, customerId: number, amount: number): Promise<any>;
    addBalance(ctx: any, customerId: number, amount: number): Promise<any>;
}
export declare function setBillPayBalancePort(p: BillPayBalancePort | null): void;
export declare function getBillPayBalancePort(): BillPayBalancePort | null;
