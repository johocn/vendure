"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.multivendorPaymentMethodHandler = void 0;
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const mv_connect_sdk_1 = require("../payment/mv-connect-sdk");
const sdk = new mv_connect_sdk_1.MyConnectSdk({ apiKey: 'MY_API_KEY' });
exports.multivendorPaymentMethodHandler = new core_1.PaymentMethodHandler({
    code: 'mv-connect-payment-method',
    description: [
        {
            languageCode: core_1.LanguageCode.en,
            value: 'Multivendor Payment Provider',
        },
    ],
    args: {},
    createPayment: async (ctx, order, amount, args, metadata) => {
        if (order.type === generated_types_1.OrderType.Seller) {
            try {
                // Create a Transfer payment to the Seller's account
                const result = await sdk.createTransfer({
                    amount,
                    currency: order.currencyCode,
                    connectedAccountId: metadata.connectedAccountId,
                    transfer_group: metadata.transfer_group,
                });
                return {
                    amount,
                    state: 'Settled',
                    transactionId: result.transactionId,
                    metadata,
                };
            }
            catch (err) {
                return {
                    amount,
                    state: 'Declined',
                    metadata: {
                        errorMessage: err.message,
                    },
                };
            }
        }
        else {
            try {
                // Create a payment to the platform's account,
                // and set the `transfer_group` option to later link
                // with the Seller transfers after the Seller orders
                // have been created.
                const result = await sdk.createPayment({
                    amount,
                    currency: order.currencyCode,
                    transfer_group: order.code,
                });
                return {
                    amount,
                    state: 'Settled',
                    transactionId: result.transactionId,
                    metadata: {
                        transfer_group: order.code,
                    },
                };
            }
            catch (err) {
                return {
                    amount,
                    state: 'Declined',
                    metadata: {
                        errorMessage: err.message,
                    },
                };
            }
        }
    },
    settlePayment: async (ctx, order, payment, args) => {
        return { success: true };
    },
});
//# sourceMappingURL=mv-payment-handler.js.map