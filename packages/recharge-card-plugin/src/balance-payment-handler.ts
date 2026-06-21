import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';

import { loggerCtx } from './constants';
import { RechargeCardService } from './recharge-card.service';

/**
 * Payment method handler for balance payment (recharge card top-up balance).
 * The service is injected dynamically via Injector in plugin.onApplicationBootstrap().
 */
let rechargeService: RechargeCardService;

export function setRechargeService(service: RechargeCardService): void {
    rechargeService = service;
}

export const balancePaymentHandler = new PaymentMethodHandler({
    code: 'balance-pay',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '余额支付' },
        { languageCode: LanguageCode.zh_Hant, value: '餘額支付' },
        { languageCode: LanguageCode.en, value: 'Balance Payment' },
    ],
    args: {},
    async createPayment(ctx, order, amount, args, metadata, method) {
        try {
            if (!ctx.activeUserId) {
                return { amount, state: 'Declined' as const, errorMessage: 'Not logged in', metadata: {} };
            }
            const result = await rechargeService.deductBalance(ctx, ctx.activeUserId, amount);
            if (!result.success) {
                return {
                    amount,
                    state: 'Declined' as const,
                    errorMessage: 'Insufficient balance',
                    metadata: { currentBalance: result.balance },
                };
            }
            return {
                amount,
                state: 'Settled' as const,
                transactionId: `BALANCE-${order.code}-${Date.now()}`,
                metadata: { remainingBalance: result.balance },
            };
        } catch (e: any) {
            Logger.error(`Balance payment failed: ${e.message}`, loggerCtx);
            return { amount, state: 'Declined' as const, errorMessage: e.message, metadata: {} };
        }
    },
    async settlePayment(ctx, order, payment, args) {
        return { success: true };
    },
    async createRefund(ctx, input, amount, order, payment, args, method) {
        try {
            if (!ctx.activeUserId) {
                return { state: 'Failed' as const, metadata: { errorMessage: 'No active user' } };
            }
            const newBalance = await rechargeService.addBalance(ctx, ctx.activeUserId, amount);
            Logger.info(`Balance refund: added ${amount} back to customer ${ctx.activeUserId}`, loggerCtx);
            return {
                state: 'Settled' as const,
                transactionId: payment.transactionId,
                metadata: { refundedAmount: amount, newBalance },
            };
        } catch (e: any) {
            Logger.error(`Balance refund failed: ${e.message}`, loggerCtx);
            return { state: 'Failed' as const, metadata: { errorMessage: e.message } };
        }
    },
});
