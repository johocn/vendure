import { OrderProcess } from '@vendure/core';
declare module '@vendure/core' {
    interface OrderStates {
        PartiallyPaid: never;
    }
}
/**
 * 统一支付计划订单状态机（新增正式态 PartiallyPaid；Deposited 由 pre-sale 插件保留为别名兼容）：
 * ArrangingPayment → PartiallyPaid（首期支付成功）
 * PartiallyPaid → PaymentSettled（全部期次付清）/ Shipped（门控放行）/ Cancelled
 * mergeTransitionDefinitions 会把本进程转移与默认进程并集。
 *
 * 发货门控（设计 §6）：
 * - deliveryGate=deposit_paid（租赁）→ 放行
 * - deliveryGate=first_period（分期）→ 放行（首付后即可发货）
 * - deliveryGate=all_paid（预订）→ 仅当存在未支付且 allowCod 的期次（COD 环：送达收款）放行
 */
export declare const paymentScheduleOrderProcess: OrderProcess<any>;
