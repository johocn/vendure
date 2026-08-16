"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentApiExtensions = void 0;
exports.paymentApiExtensions = `
    extend type Mutation {
        payMarketplaceSellerOrder(orderId: ID!, method: String!, metadata: JSON): PaySellerOrderResult!
    }

    union PaySellerOrderResult =
        | Order
        | OrderPaymentStateError
        | IneligiblePaymentMethodError
        | PaymentFailedError
        | PaymentDeclinedError
        | OrderStateTransitionError
        | NoActiveOrderError
`;
