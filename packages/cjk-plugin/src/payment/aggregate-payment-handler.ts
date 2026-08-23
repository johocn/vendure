import { LanguageCode, PaymentMethodHandler } from '@vendure/core';

/**
 * 聚合码支付处理器（线下扫码 + 自确认）
 *
 * 顾客在门店/配送处扫描商家聚合收款码（微信/支付宝）后，在 App 内确认
 * 「已完成支付」，系统即视为已收款（离线，不经第三方网关回调），与货到付款一致。
 */
export const aggregatePaymentHandler = new PaymentMethodHandler({
    code: 'aggregate-pay',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '聚合码支付' },
        { languageCode: LanguageCode.en, value: 'Aggregate QR Pay' },
    ],
    args: {},
    createPayment: async (ctx, order, amount, args, metadata) => {
        return {
            amount,
            state: 'Authorized' as const,
            transactionId: `AGG-${order.code}`,
            metadata: { method: 'aggregate-pay' },
        };
    },
    settlePayment: async (ctx, order, payment, args) => {
        return { success: true };
    },
});