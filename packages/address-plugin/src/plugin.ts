import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { ADDRESS_PLUGIN_OPTIONS } from './constants';
import { DeliveryAddress } from './delivery-address.entity';
import { DeliveryAdminResolver } from './delivery-admin.resolver';
import { DeliveryRange } from './delivery-range.entity';
import { DeliveryService } from './delivery.service';
import { DeliveryShopResolver } from './delivery-shop.resolver';
import { AddressPluginOptions } from './types';
import { addressOrderCustomFields } from './order-custom-fields';
import { rangeShippingCalculator } from './range-shipping-calculator';
import { rangeShippingEligibilityChecker } from './range-shipping-eligibility-checker';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type DeliveryRange {
        id: ID!
        shopId: ID!
        enabled: Boolean!
        rangeType: String!
        centerLng: Float
        centerLat: Float
        radiusKm: Float
        districtCodes: [String!]
        baseFee: Int!
        freeThreshold: Int
    }

    input DeliveryRangeInput {
        shopId: ID!
        enabled: Boolean
        rangeType: String
        centerLng: Float
        centerLat: Float
        radiusKm: Float
        districtCodes: [String!]
        baseFee: Int
        freeThreshold: Int
    }

    extend type Query {
        deliveryRange(shopId: ID!): DeliveryRange
    }

    extend type Mutation {
        upsertDeliveryRange(input: DeliveryRangeInput!): DeliveryRange!
    }
`;

const shopSchema = () => gql`
    type DeliveryAddress {
        id: ID!
        fullName: String!
        phone: String!
        province: String
        city: String
        district: String
        provinceCode: String
        cityCode: String
        districtCode: String
        detail: String
        lng: Float
        lat: Float
        isDefault: Boolean!
    }

    input DeliveryAddressInput {
        fullName: String!
        phone: String!
        province: String
        city: String
        district: String
        provinceCode: String
        cityCode: String
        districtCode: String
        detail: String
        lng: Float
        lat: Float
    }

    type DeliveryRange {
        id: ID!
        shopId: ID!
        enabled: Boolean!
        rangeType: String!
        centerLng: Float
        centerLat: Float
        radiusKm: Float
        districtCodes: [String!]
        baseFee: Int!
        freeThreshold: Int
    }

    type DeliveryResult {
        shopId: ID!
        inRange: Boolean!
        reason: String!
    }

    type OrderDeliveryStatus {
        deliverable: Boolean!
        results: [DeliveryResult!]!
    }

    input ValidateDeliveryInput {
        address: DeliveryAddressInput!
        shopIds: [ID!]!
    }

    extend type Query {
        myDeliveryAddresses: [DeliveryAddress!]!
        shopDeliveryRange(shopId: ID!): DeliveryRange
        validateDelivery(input: ValidateDeliveryInput!): [DeliveryResult!]!
        activeOrderDeliveryStatus: OrderDeliveryStatus
    }

    extend type Mutation {
        createDeliveryAddress(input: DeliveryAddressInput!): DeliveryAddress!
        updateDeliveryAddress(id: ID!, input: DeliveryAddressInput!): DeliveryAddress!
        deleteDeliveryAddress(id: ID!): Boolean!
        setDefaultDeliveryAddress(id: ID!): [DeliveryAddress!]!
        setOrderShippingFromAddress(deliveryAddressId: ID!): DeliveryAddress!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [DeliveryAddress, DeliveryRange],
    providers: [
        { provide: ADDRESS_PLUGIN_OPTIONS, useFactory: () => AddressPlugin.options },
        DeliveryService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [DeliveryAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [DeliveryShopResolver],
    },
    configuration: (config) => {
        // 订单侧收件区划码/经纬度（结算校验 + 运费联动取值源）；按字段名幂等去重
        const orderNames = new Set((config.customFields.Order ?? []).map(f => f.name));
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...addressOrderCustomFields.filter(f => f != null && !orderNames.has(f.name)),
        ];
        // 结算拦截 + 按店运费：注册 checker/calculator（幂等去重）
        const checkerCodes = new Set(
            config.shippingOptions.shippingEligibilityCheckers.map(c => c.code),
        );
        if (!checkerCodes.has(rangeShippingEligibilityChecker.code)) {
            config.shippingOptions.shippingEligibilityCheckers.push(rangeShippingEligibilityChecker);
        }
        const calcCodes = new Set(config.shippingOptions.shippingCalculators.map(c => c.code));
        if (!calcCodes.has(rangeShippingCalculator.code)) {
            config.shippingOptions.shippingCalculators.push(rangeShippingCalculator);
        }
        return config;
    },
    compatibility: '^3.0.0',
})
export class AddressPlugin {
    private static options: AddressPluginOptions = {};

    constructor(@Inject(ADDRESS_PLUGIN_OPTIONS) private options: AddressPluginOptions) {}

    static init(options?: AddressPluginOptions): Type<AddressPlugin> {
        AddressPlugin.options = options ?? {};
        return AddressPlugin;
    }
}