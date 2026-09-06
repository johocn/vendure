import gql from 'graphql-tag';

/**
 * Shop 端：C 端按订单号（+ 可选手机号）取核销码/二维码载荷。
 */
export const redemptionShopSchema = gql`
    extend type Query {
        orderRedemptionCode(input: OrderRedemptionCodeInput!): OrderRedemptionResult
    }

    input OrderRedemptionCodeInput {
        orderCode: String!
        phone: String
    }

    type OrderRedemptionResult {
        redemptionCode: String
        qrPayload: String
        barcodePayload: String
        claimed: Boolean!
        canAccess: Boolean!
        status: String!        # active | expiring_soon | expired | claimed
        expiresAt: DateTime
        reissueable: Boolean!
        version: Int
    }
`;

/**
 * Admin 端：租户管理员按核销码检索订单 + 核销。
 */
export const redemptionAdminSchema = gql`
    extend type Query {
        redemptionLookup(code: String!): RedemptionLookupResult
    }
    extend type Mutation {
        redemptionClaim(code: String!): RedemptionClaimResult
        redemptionReissue(code: String!): RedemptionClaimResult
    }

    type RedemptionOrder {
        id: ID!
        code: String!
        state: String!
        totalWithTax: Int!
        currencyCode: String!
        totalQuantity: Int!
    }

    type RedemptionLookupResult {
        order: RedemptionOrder
        claimed: Boolean!
        claimedAt: DateTime
        status: String!
        expiresAt: DateTime
        version: Int
        reissueable: Boolean!
    }

    type RedemptionClaimResult {
        order: RedemptionOrder
        claimed: Boolean!
        claimedAt: DateTime
        message: String
        status: String!
        expiresAt: DateTime
        version: Int
    }

    "租户域：本渠道待核销自提单（deliveryType=pickup 且未核销）"
    type PendingRedemption {
        orderId: ID!
        orderCode: String!
        code: String!
        status: String!        # active | expiring_soon | expired
        expiresAt: DateTime
        version: Int
        claimed: Boolean!
    }
    type PendingRedemptionList {
        items: [PendingRedemption!]!
        totalItems: Int!
    }
    input RedemptionListOptions {
        skip: Int
        take: Int
    }
    extend type Query {
        myPendingRedemptions(options: RedemptionListOptions): PendingRedemptionList!
    }
`;