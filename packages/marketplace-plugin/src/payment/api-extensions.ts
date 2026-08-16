export const paymentApiExtensions = `
    extend type Mutation {
        payMarketplaceSellerOrder(orderId: ID!, method: String!, metadata: JSON): PaySellerOrderResult!
    }

    extend type Query {
        myMarketplaceSellerOrders: [PaySellerOrder!]!
    }

    union PaySellerOrderResult =
        | Order
        | OrderPaymentStateError
        | IneligiblePaymentMethodError
        | PaymentFailedError
        | PaymentDeclinedError
        | OrderStateTransitionError
        | NoActiveOrderError

    type PaySellerOrder {
        id: ID!
        code: String!
        state: String!
        totalWithTax: Int!
        sellerChannelName: String
        lines: [PaySellerOrderLine!]!
    }

    type PaySellerOrderLine {
        id: ID!
        productName: String!
        quantity: Int!
        unitPriceWithTax: Int!
        linePriceWithTax: Int!
    }
`;