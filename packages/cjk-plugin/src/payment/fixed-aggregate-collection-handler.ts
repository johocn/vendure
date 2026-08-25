import { LanguageCode, PaymentMethodHandler } from '@vendure/core';

/**
 * 固定聚合码收款处理器（门店到店收银）
 *
 * 门店到店收银：顾客扫码商家固定的聚合收款码（微信/支付宝）付款到商户，
 * 店员确认到账后完成订单。离线自确认，不经第三方网关回调，与到店收银一致。
 */
export const fixedAggregateCollectionHandler = new PaymentMethodHandler({
    code: 'fixed-aggregate-collection',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '固定聚合码收款' },
        { languageCode: LanguageCode.en, value: 'Fixed Aggregate QR Collection' },
    ],
    args: {},
    createPayment: async (ctx, order, amount, args, metadata) => {
        return {
            amount,
            state: 'Authorized' as const,
            transactionId: `FIXED-AGG-${order.code}`,
            metadata: { method: 'fixed-aggregate-collection' },
        };
    },
    settlePayment: async (ctx, order, payment, args) => {
        return { success: true };
    },
});