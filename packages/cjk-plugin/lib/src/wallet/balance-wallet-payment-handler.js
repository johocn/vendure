"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.balanceWalletPaymentHandler = void 0;
exports.setWalletService = setWalletService;
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
/**
 * 全局共享余额钱包支付处理器
 *
 * 说明：recharge-card-plugin 里的 `balance-pay` handler 针对的是**顾客个人**余额
 * （CustomerBalance/BalanceTransaction，逐档位分渠道），与本插件的「全局共享钱包」
 * （所有租户共用、总合并清算）语义不同；且两插件同时启用时 handler code 不能重复。
 * 故本插件新建独立 handler，code 用 `balance-wallet`，createPayment 直接调用
 * WalletService.debit 从共享钱包扣减订单总额。
 *
 * 服务经 Injector 在 onApplicationBootstrap 注入（与 recharge-card 同模式）。
 */
let walletService;
function setWalletService(service) {
    walletService = service;
}
exports.balanceWalletPaymentHandler = new core_1.PaymentMethodHandler({
    code: 'balance-wallet',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '共享余额支付' },
        { languageCode: core_1.LanguageCode.zh_Hant, value: '共享餘額支付' },
        { languageCode: core_1.LanguageCode.en, value: 'Shared Balance Payment' },
    ],
    args: {},
    async createPayment(ctx, order, amount, args, metadata) {
        try {
            if (!ctx.activeUserId) {
                return { amount, state: 'Declined', errorMessage: 'Not logged in', metadata: {} };
            }
            const wallet = await walletService.debit(ctx, amount);
            return {
                amount,
                state: 'Settled',
                transactionId: `WB-${order.code}-${Date.now()}`,
                metadata: { remainingBalance: wallet.balance },
            };
        }
        catch (e) {
            core_1.Logger.error(`Shared balance payment failed: ${e.message}`, constants_1.loggerCtx);
            return { amount, state: 'Declined', errorMessage: e.message, metadata: {} };
        }
    },
    async settlePayment(ctx, order, payment, args) {
        return { success: true };
    },
    async createRefund(ctx, input, amount, order, payment, args) {
        try {
            const wallet = await walletService.credit(ctx, amount);
            core_1.Logger.info(`Shared balance refund: ${amount} credited back to wallet`, constants_1.loggerCtx);
            return {
                state: 'Settled',
                transactionId: payment.transactionId,
                metadata: { refundedAmount: amount, newBalance: wallet.balance },
            };
        }
        catch (e) {
            core_1.Logger.error(`Shared balance refund failed: ${e.message}`, constants_1.loggerCtx);
            return { state: 'Failed', metadata: { errorMessage: e.message } };
        }
    },
});
//# sourceMappingURL=balance-wallet-payment-handler.js.map