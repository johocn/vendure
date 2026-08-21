import { LanguageCode, Logger, OrderService, PaymentMethodHandler } from '@vendure/core';

import { loggerCtx } from './constants';
import { RechargeCardService } from './recharge-card.service';

/**
 * Payment method handler for balance payment (recharge card top-up balance).
 * The services are injected dynamically via Injector in plugin.onApplicationBootstrap().
 */
let rechargeService: RechargeCardService;
let orderService: OrderService;

export function setRechargeService(service: RechargeCardService): void {
    rechargeService = service;
}

export function setOrderService(service: OrderService): void {
    orderService = service;
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
            const orderWithCustomer = await orderService.findOne(ctx, order.id);
            if (!orderWithCustomer?.customer) {
                return { amount, state: 'Declined' as const, errorMessage: 'Cannot identify customer', metadata: {} };
            }
            // 防重复扣减：该订单已有余额 CONSUME 记录则拒绝
            const alreadyPaid = await rechargeService.isOrderBalancePaid(ctx, order.id);
            if (alreadyPaid) {
                return { amount, state: 'Declined' as const, errorMessage: 'Order already paid by balance', metadata: {} };
            }
            const remainingBalance = await rechargeService.deductBalance(
                ctx, String(orderWithCustomer.customer.id), amount, order.id,
            );
            return {
                amount,
                state: 'Settled' as const,
                transactionId: `BALANCE-${order.code}-${Date.now()}`,
                metadata: { remainingBalance },
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
            // Refunds may be triggered by an administrator or system job, so
            // ctx.activeUserId cannot be trusted to identify the order's owner.
            // Reload the order to reliably resolve its customer.
            const orderWithCustomer = await orderService.findOne(ctx, order.id);
            if (!orderWithCustomer?.customer) {
                return { state: 'Failed' as const, metadata: { errorMessage: 'Cannot refund: order has no customer' } };
            }
            // 退款不超该单余额消费额
            const consumed = await rechargeService.getOrderBalanceConsumed(ctx, order.id);
            if (amount > consumed) {
                return { state: 'Failed' as const, metadata: { errorMessage: 'Refund exceeds order balance payment' } };
            }
            const newBalance = await rechargeService.addBalance(
                ctx, String(orderWithCustomer.customer.id), amount, order.id, payment.id,
            );
            Logger.info(`Balance refund: added ${amount} back to customer ${orderWithCustomer.customer.id}`, loggerCtx);
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
