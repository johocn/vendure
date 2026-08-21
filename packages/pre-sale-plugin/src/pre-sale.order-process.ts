import { OrderProcess } from '@vendure/core';

declare module '@vendure/core' {
    interface OrderStates {
        Deposited: never;
    }
}

/**
 * 预售两阶段支付自定义订单状态机：
 * ArrangingPayment → Deposited（已付定金，等待尾款）
 * Deposited → PaymentSettled（尾款补齐，可发货）
 * Deposited ← 可回退 AddingItems（改单）/ Cancelled（取消回滚+退定金）
 *
 * 通过 OrderStates 接口增强把 Deposited 并入 OrderState 联合类型；
 * mergeTransitionDefinitions 会把本进程的转移与默认进程并集，
 * 其余状态转移保持默认进程原样（对齐阶段10 Completed 写法）。
 */
export const preSaleOrderProcess: OrderProcess<any> = {
    transitions: {
        ArrangingPayment: { to: ['AddingItems', 'Deposited', 'PaymentSettled', 'Cancelled'] },
        Deposited: { to: ['PaymentSettled', 'AddingItems', 'Cancelled'] },
    },
};