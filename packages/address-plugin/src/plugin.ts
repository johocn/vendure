import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { ADDRESS_PLUGIN_OPTIONS } from './constants';
import { DeliveryAddress } from './delivery-address.entity';
import { DeliveryAdminResolver } from './delivery-admin.resolver';
import { DeliveryRange } from './delivery-range.entity';
import { DeliveryService } from './delivery.service';
import { DeliveryShopResolver } from './delivery-shop.resolver';
import { AddressPluginOptions } from './types';

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
    }

    input DeliveryRangeInput {
        shopId: ID!
        enabled: Boolean
        rangeType: String
        centerLng: Float
        centerLat: Float
        radiusKm: Float
        districtCodes: [String!]
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
    }

    type DeliveryResult {
        shopId: ID!
        inRange: Boolean!
        reason: String!
    }

    input ValidateDeliveryInput {
        address: DeliveryAddressInput!
        shopIds: [ID!]!
    }

    extend type Query {
        myDeliveryAddresses: [DeliveryAddress!]!
        shopDeliveryRange(shopId: ID!): DeliveryRange
        validateDelivery(input: ValidateDeliveryInput!): [DeliveryResult!]!
    }

    extend type Mutation {
        createDeliveryAddress(input: DeliveryAddressInput!): DeliveryAddress!
        updateDeliveryAddress(id: ID!, input: DeliveryAddressInput!): DeliveryAddress!
        deleteDeliveryAddress(id: ID!): Boolean!
        setDefaultDeliveryAddress(id: ID!): [DeliveryAddress!]!
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
    configuration: (config) => config,
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