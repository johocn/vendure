"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.balancePaymentHandler = void 0;
exports.setRechargeService = setRechargeService;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * Payment method handler for balance payment (recharge card top-up balance).
 * The service is injected dynamically via Injector in plugin.onApplicationBootstrap().
 */
let rechargeService;
function setRechargeService(service) {
    rechargeService = service;
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
            const result = await rechargeService.deductBalance(ctx, ctx.activeUserId, amount);
            if (!result.success) {
                return {
                    amount,
                    state: 'Declined',
                    errorMessage: 'Insufficient balance',
                    metadata: { currentBalance: result.balance },
                };
            }
            return {
                amount,
                state: 'Settled',
                transactionId: `BALANCE-${order.code}-${Date.now()}`,
                metadata: { remainingBalance: result.balance },
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
            if (!ctx.activeUserId) {
                return { state: 'Failed', metadata: { errorMessage: 'No active user' } };
            }
            const newBalance = await rechargeService.addBalance(ctx, ctx.activeUserId, amount);
            core_1.Logger.info(`Balance refund: added ${amount} back to customer ${ctx.activeUserId}`, constants_1.loggerCtx);
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