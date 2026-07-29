"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyConnectSdk = void 0;
/**
 * @description
 * A fake payment API based loosely on the Stripe Connect multiparty payments flow
 * described here: https://stripe.com/docs/connect/charges-transfers
 */
class MyConnectSdk {
    constructor(options) {
        this.options = options;
    }
    /**
     * Used to create a payment on the platform itself.
     */
    async createPayment(options) {
        return { transactionId: Math.random().toString(36).substring(3) };
    }
    /**
     * Used to create a transfer payment to a Seller.
     */
    async createTransfer(options) {
        return { transactionId: Math.random().toString(36).substring(3) };
    }
}
exports.MyConnectSdk = MyConnectSdk;
//# sourceMappingURL=mv-connect-sdk.js.map