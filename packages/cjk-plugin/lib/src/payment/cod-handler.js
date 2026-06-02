"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codPaymentHandler = void 0;
const core_1 = require("@vendure/core");
exports.codPaymentHandler = new core_1.PaymentMethodHandler({
    code: 'cash-on-delivery',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '货到付款' },
        { languageCode: core_1.LanguageCode.zh_Hant, value: '貨到付款' },
        { languageCode: core_1.LanguageCode.ja, value: '代金引換' },
        { languageCode: core_1.LanguageCode.ko, value: '착불 결제' },
        { languageCode: core_1.LanguageCode.en, value: 'Cash on Delivery' },
    ],
    args: {},
    createPayment: async (ctx, order, amount, args, metadata) => {
        return {
            amount,
            state: 'Authorized',
            transactionId: `COD-${order.code}`,
            metadata: { method: 'cash-on-delivery' },
        };
    },
    settlePayment: async (ctx, order, payment, args) => {
        return { success: true };
    },
});
//# sourceMappingURL=cod-handler.js.map