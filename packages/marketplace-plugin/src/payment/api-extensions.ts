export const paymentApiExtensions = `
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