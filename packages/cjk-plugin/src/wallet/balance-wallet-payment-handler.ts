import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';

import { loggerCtx } from '../constants';
import { WalletService } from './wallet.service';

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
let walletService: WalletService;

export function setWalletService(service: WalletService): void {
    walletService = service;
}

export const balanceWalletPaymentHandler = new PaymentMethodHandler({
    code: 'balance-wallet',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '共享余额支付' },
        { languageCode: LanguageCode.zh_Hant, value: '共享餘額支付' },
        { languageCode: LanguageCode.en, value: 'Shared Balance Payment' },
    ],
    args: {},
    async createPayment(ctx, order, amount, args, metadata) {
        try {
            if (!ctx.activeUserId) {
                return { amount, state: 'Declined' as const, errorMessage: 'Not logged in', metadata: {} };
            }
            const wallet = await walletService.debit(ctx, amount);
            return {
                amount,
                state: 'Settled' as const,
                transactionId: `WB-${order.code}-${Date.now()}`,
                metadata: { remainingBalance: wallet.balance },
            };
        } catch (e: any) {
            Logger.error(`Shared balance payment failed: ${e.message}`, loggerCtx);
            return { amount, state: 'Declined' as const, errorMessage: e.message, metadata: {} };
        }
    },
    async settlePayment(ctx, order, payment, args) {
        return { success: true };
    },
    async createRefund(ctx, input, amount, order, payment, args) {
        try {
            const wallet = await walletService.credit(ctx, amount);
            Logger.info(`Shared balance refund: ${amount} credited back to wallet`, loggerCtx);
            return {
                state: 'Settled' as const,
                transactionId: payment.transactionId,
                metadata: { refundedAmount: amount, newBalance: wallet.balance },
            };
        } catch (e: any) {
            Logger.error(`Shared balance refund failed: ${e.message}`, loggerCtx);
            return { state: 'Failed' as const, metadata: { errorMessage: e.message } };
        }
    },
});