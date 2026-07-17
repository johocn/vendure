"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.balancePaymentHandler = void 0;
exports.setRechargeService = setRechargeService;
exports.setOrderService = setOrderService;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * Payment method handler for balance payment (recharge card top-up balance).
 * The services are injected dynamically via Injector in plugin.onApplicationBootstrap().
 */
let rechargeService;
let orderService;
function setRechargeService(service) {
    rechargeService = service;
}
function setOrderService(service) {
    orderService = service;
}
exports.balancePaymentHandler = new core_1.PaymentMethodHandler({
    code: 'balance-pay',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '余额支付' },
        { languageCode: core_1.LanguageCode.zh_Hant, value: '餘額支付' },
        { languageCode: core_1.LanguageCode.en, value: 'Balance Payment' },
    ],
    args: {},
    async createPayment(ctx, order, amount, args, metadata, method) {
        try {
            if (!ctx.activeUserId) {
                return { amount, state: 'Declined', errorMessage: 'Not logged in', metadata: {} };
            }
            const remainingBalance = await rechargeService.deductBalance(ctx, ctx.activeUserId, amount, order.id);
            return {
                amount,
                state: 'Settled',
                transactionId: `BALANCE-${order.code}-${Date.now()}`,
                metadata: { remainingBalance },
            };
        }
        catch (e) {
            core_1.Logger.error(`Balance payment failed: ${e.message}`, constants_1.loggerCtx);
            return { amount, state: 'Declined', errorMessage: e.message, metadata: {} };
        }
    },
    async settlePayment(ctx, order, payment, args) {
        return { success: true };
    },
    async createRefund(ctx, input, amount, order, payment, args, method) {
        try {
            // Refunds may be triggered by an administrator or system job, so
            // ctx.activeUserId cannot be trusted to identify the order's owner.
            // Reload the order to reliably resolve its customer.
            const orderWithCustomer = await orderService.findOne(ctx, order.id);
            if (!(orderWithCustomer === null || orderWithCustomer === void 0 ? void 0 : orderWithCustomer.customer)) {
                return { state: 'Failed', metadata: { errorMessage: 'Cannot refund: order has no customer' } };
            }
            const newBalance = await rechargeService.addBalance(ctx, String(orderWithCustomer.customer.id), amount, order.id, payment.id);
            core_1.Logger.info(`Balance refund: added ${amount} back to customer ${orderWithCustomer.customer.id}`, constants_1.loggerCtx);
            return {
                state: 'Settled',
                transactionId: payment.transactionId,
                metadata: { refundedAmount: amount, newBalance },
            };
        }
        catch (e) {
            core_1.Logger.error(`Balance refund failed: ${e.message}`, constants_1.loggerCtx);
            return { state: 'Failed', metadata: { errorMessage: e.message } };
        }
    },
});
//# sourceMappingURL=balance-payment-handler.js.map