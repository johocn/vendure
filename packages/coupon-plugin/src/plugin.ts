import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { COUPON_PLUGIN_OPTIONS } from './constants';
import { CouponCode } from './coupon-code.entity';
import { CouponAdminResolver } from './coupon-admin.resolver';
import { expireCouponsTask } from './coupon-expire.job';
import { CouponService } from './coupon.service';
import { CouponShopResolver } from './coupon-shop.resolver';
import { Coupon } from './coupon.entity';
import { CouponPluginOptions } from './types';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type Coupon {
        id: ID!
        name: String!
        description: String
        couponType: String!
        discountValue: Int!
        minSpend: Int!
        maxDiscount: Int!
        startAt: DateTime!
        endAt: DateTime!
        totalQuantity: Int!
        claimedCount: Int!
        limitPerUser: Int!
        isActive: Boolean!
        applicableProductIds: [ID!]
        applicableCategoryIds: [ID!]
        isNewUserOnly: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type CouponList implements PaginatedList {
        items: [Coupon!]!
        totalItems: Int!
    }

    input CreateCouponInput {
        name: String!
        description: String
        couponType: String!
        discountValue: Int!
        minSpend: Int
        maxDiscount: Int
        startAt: DateTime!
        endAt: DateTime!
        totalQuantity: Int!
        limitPerUser: Int
        isActive: Boolean
        applicableProductIds: [ID!]
        applicableCategoryIds: [ID!]
        isNewUserOnly: Boolean
    }

    input UpdateCouponInput {
        name: String
        description: String
        startAt: DateTime
        endAt: DateTime
        totalQuantity: Int
        limitPerUser: Int
        isActive: Boolean
    }

    input CouponListOptions

    extend type Query {
        coupons(options: CouponListOptions): CouponList!
        coupon(id: ID!): Coupon
    }

    extend type Mutation {
        createCoupon(input: CreateCouponInput!): Coupon!
        updateCoupon(id: ID!, input: UpdateCouponInput!): Coupon!
        deleteCoupon(id: ID!): Boolean!
    }
`;

const shopSchema = () => gql`
    type Coupon {
        id: ID!
        name: String!
        description: String
        couponType: String!
        discountValue: Int!
        minSpend: Int!
        maxDiscount: Int!
        startAt: DateTime!
        endAt: DateTime!
        totalQuantity: Int!
        claimedCount: Int!
        limitPerUser: Int!
        isActive: Boolean!
        applicableProductIds: [ID!]
        applicableCategoryIds: [ID!]
        isNewUserOnly: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type CouponCode {
        id: ID!
        couponId: ID!
        coupon: Coupon!
        customerId: ID!
        code: String!
        status: String!
        claimedAt: DateTime
        usedAt: DateTime
        orderId: ID
        createdAt: DateTime!
    }

    type CouponValidationResult {
        valid: Boolean!
        discountAmount: Int!
        error: String
    }

    extend type Query {
        availableCoupons: [Coupon!]!
        myCoupons(status: String): [CouponCode!]!
        validateCoupon(code: String!, orderId: ID): CouponValidationResult!
    }

    extend type Mutation {
        claimCoupon(couponId: ID!): CouponCode!
        redeemCoupon(code: String!, orderId: ID!): CouponCode!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Coupon, CouponCode],
    providers: [
        { provide: COUPON_PLUGIN_OPTIONS, useFactory: () => CouponPlugin.options },
        CouponService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [CouponAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [CouponShopResolver],
    },
    configuration: config => {
        if (!config.schedulerOptions) {
            config.schedulerOptions = { tasks: [] } as any;
        }
        if (!config.schedulerOptions.tasks) {
            config.schedulerOptions.tasks = [];
        }
        config.schedulerOptions.tasks.push(expireCouponsTask);
        return config;
    },
    compatibility: '^3.0.0',
})
export class CouponPlugin {
    private static options: CouponPluginOptions = {};

    constructor(@Inject(COUPON_PLUGIN_OPTIONS) private options: CouponPluginOptions) {}

    static init(options?: CouponPluginOptions): Type<CouponPlugin> {
        CouponPlugin.options = options ?? {};
        return CouponPlugin;
    }
}
