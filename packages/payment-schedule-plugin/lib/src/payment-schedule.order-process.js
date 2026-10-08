"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentScheduleOrderProcess = void 0;
const order_payment_schedule_entity_1 = require("./order-payment-schedule.entity");
const order_schedule_item_entity_1 = require("./order-schedule-item.entity");
const payment_schedule_runtime_1 = require("./payment-schedule-runtime");
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
exports.paymentScheduleOrderProcess = {
    transitions: {
        ArrangingPayment: { to: ['AddingItems', 'PartiallyPaid', 'PaymentSettled', 'Cancelled'] },
        PartiallyPaid: { to: ['PaymentSettled', 'Shipped', 'Cancelled'] },
        // 发货/送达后继续付余下期次，付清时结算（默认状态机无此两条转移；merge 为并集）
        Shipped: { to: ['PaymentSettled'] },
        Delivered: { to: ['PaymentSettled'] },
    },
    async onTransitionStart(fromState, toState, data) {
        if (fromState !== 'PartiallyPaid' || toState !== 'Shipped') {
            return;
        }
        let schedule = null;
        try {
            const conn = (0, payment_schedule_runtime_1.getPaymentScheduleConnection)();
            schedule = await conn
                .getRepository(data.ctx, order_payment_schedule_entity_1.OrderPaymentSchedule)
                .findOne({ where: { orderId: data.order.id } });
        }
        catch (_a) {
            return; // 运行时未初始化（理论上不可能），不拦截
        }
        if (!schedule)
            return;
        if (schedule.deliveryGate === 'deposit_paid' || schedule.deliveryGate === 'first_period') {
            return;
        }
        // all_paid：COD 豁免
        const items = await (0, payment_schedule_runtime_1.getPaymentScheduleConnection)()
            .getRepository(data.ctx, order_schedule_item_entity_1.OrderScheduleItem)
            .find({ where: { scheduleId: schedule.id } });
        const unpaidCod = items.some(i => ['locked', 'payable', 'overdue'].includes(i.status) && i.allowCod);
        if (unpaidCod)
            return;
        return '未付清全部期次，不能发货';
    },
};
