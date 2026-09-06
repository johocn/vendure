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
        redemptionClaim(code: String!, collect: Boolean): RedemptionClaimResult
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

    "到店收款分账后台（台账 merchant_settlement_ledger）——本类型仅承载核销收款相关判定字段"
    type RedemptionLookupResult {
        order: RedemptionOrder
        claimed: Boolean!
        claimedAt: DateTime
        status: String!
        expiresAt: DateTime
        version: Int
        reissueable: Boolean!
        "支付方式 code；命中 COD_PAYMENT_CODES 即到店/货到付款"
        paymentType: String
        "是否已确认收款（order.customFields.collected）"
        collected: Boolean!
    }

    type RedemptionClaimResult {
        order: RedemptionOrder
        claimed: Boolean!
        claimedAt: DateTime
        message: String
        status: String!
        expiresAt: DateTime
        version: Int
        "true 表示该 COD 单未收款且当前为强制模式，必须先确认收款才能核销"
        collectRequired: Boolean!
        "核销是否已（同步）确认到店收款"
        collected: Boolean!
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
        "支付方式 code；命中到店/货到付款集合时为 COD"
        paymentType: String
        "是否已确认收款（到店付款单据此高亮待收款）"
        collected: Boolean!
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