import { LanguageCode, PaymentMethodHandler } from '@vendure/core';

export const codPaymentHandler = new PaymentMethodHandler({
    code: 'cash-on-delivery',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '货到付款' },
        { languageCode: LanguageCode.zh_Hant, value: '貨到付款' },
        { languageCode: LanguageCode.ja, value: '代金引換' },
        { languageCode: LanguageCode.ko, value: '착불 결제' },
        { languageCode: LanguageCode.en, value: 'Cash on Delivery' },
    ],
    args: {},
    createPayment: async (ctx, order, amount, args, metadata) => {
        return {
            amount,
            state: 'Authorized' as const,
            transactionId: `COD-${order.code}`,
            metadata: { method: 'cash-on-delivery' },
        };
    },
    settlePayment: async (ctx, order, payment, args) => {
        return { success: true };
    },
});
