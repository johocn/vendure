import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { Type } from '@nestjs/common';

import { Merchant } from './merchant.entity';
import { MerchantStore } from './merchant-store.entity';
import { MerchantStoreChannel } from './merchant-store-channel.entity';
import { MerchantStoreStaff } from './merchant-store-staff.entity';
import { MerchantStoreService } from './merchant-store.service';
import {
    MerchantAdminResolver,
    MerchantFieldResolver,
    MerchantStoreFieldResolver,
} from './merchant-admin.resolver';
import { MerchantShopResolver } from './merchant-shop.resolver';
import { CreateMerchantTablesMigration } from './migrations/create-merchant-tables';

const { gql } = require('graphql-tag');

const adminSchema = gql`
    type Merchant implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        code: String!
        name: String!
        shortName: String
        logo: String
        brand: String
        intro: String
        tags: [String!]
        legalName: String
        licenseNo: String
        licenseImage: String
        licenseExpiry: DateTime
        merchantType: String!
        industry: String
        category: String
        contactName: String
        contactPhone: String
        servicePhone: String
        complaintPhone: String
        email: String
        wechat: String
        province: String
        city: String
        district: String
        street: String
        address: String
        ownerChannelId: ID
        claimStatus: String!
        contractNo: String
        cooperationStart: DateTime
        cooperationEnd: DateTime
        commissionRate: Int
        source: String!
        settlementType: String
        bankName: String
        bankAccountName: String
        bankAccountNo: String
        taxNo: String
        invoiceTitle: String
        status: String!
        statusReason: String
        closedAt: DateTime
    }

    type MerchantStore implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        merchantId: ID!
        code: String!
        name: String!
        storeType: String!
        sortOrder: Int!
        weight: Int!
        country: String!
        province: String
        city: String
        cityCode: String
        district: String
        street: String
        addressLine: String
        detail: String
        postalCode: String
        lat: Float
        lng: Float
        coordinateSystem: String!
        geohash: String
        mapPoiId: String
        mapProvider: String
        navigationAddress: String
        phoneNumber: String
        backupPhone: String
        managerName: String
        managerPhone: String
        wechat: String
        servicePhone: String
        businessHours: String
        businessHoursText: String
        timezone: String!
        specialDates: String
        holidayPlan: String
        status: String!
        statusNote: String
        reopenAt: DateTime
        acceptingOrders: Boolean!
        coverImage: String
        photos: [String!]
        videos: [String!]
        panoramaUrl: String
        notice: String
        tags: [String!]
        facilities: [String!]
        supportsRedemption: Boolean!
        redemptionHours: String
        dailyRedeemLimit: Int
        requiresReservation: Boolean!
        reservationPhone: String
        supportsDelivery: Boolean!
        deliveryRadiusKm: Int
        deliveryFee: Int
        minOrderAmount: Int
        deliveryMinutes: Int
        externalIds: String
        source: String!
        lastSyncAt: DateTime
        isPublic: Boolean!
        enabled: Boolean!
        createdBy: String
        updatedBy: String
        deletedAt: DateTime
    }

    type MerchantStoreChannel implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        storeId: ID!
        channelId: ID!
        role: String!
        status: String!
        claimedByUserId: ID
        claimedAt: DateTime
        verifiedAt: DateTime
        contractNo: String
        note: String
    }

    type MerchantStoreStaff implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        storeId: ID!
        userId: ID!
        name: String
        phone: String
        role: String!
        status: String!
        lastLoginAt: DateTime
    }

    type MerchantList {
        items: [Merchant!]!
        totalItems: Int!
    }

    type MerchantStoreList {
        items: [MerchantStore!]!
        totalItems: Int!
    }

    input MerchantListOptions {
        skip: Int
        take: Int
        keyword: String
        status: String
        claimStatus: String
    }

    input MerchantStoreListOptions {
        skip: Int
        take: Int
        merchantId: ID
        city: String
        status: String
        keyword: String
    }

    input CreateMerchantInput {
        code: String!
        name: String!
        shortName: String
        logo: String
        brand: String
        intro: String
        tags: [String!]
        legalName: String
        licenseNo: String
        licenseImage: String
        licenseExpiry: DateTime
        merchantType: String
        industry: String
        category: String
        contactName: String
        contactPhone: String
        servicePhone: String
        complaintPhone: String
        email: String
        wechat: String
        province: String
        city: String
        district: String
        street: String
        address: String
        ownerChannelId: ID
        claimStatus: String
        contractNo: String
        cooperationStart: DateTime
        cooperationEnd: DateTime
        commissionRate: Int
        source: String
        settlementType: String
        bankName: String
        bankAccountName: String
        bankAccountNo: String
        taxNo: String
        invoiceTitle: String
        status: String
        statusReason: String
        closedAt: DateTime
    }

    input UpdateMerchantInput {
        id: ID!
        code: String
        name: String
        shortName: String
        logo: String
        brand: String
        intro: String
        tags: [String!]
        legalName: String
        licenseNo: String
        licenseImage: String
        licenseExpiry: DateTime
        merchantType: String
        industry: String
        category: String
        contactName: String
        contactPhone: String
        servicePhone: String
        complaintPhone: String
        email: String
        wechat: String
        province: String
        city: String
        district: String
        street: String
        address: String
        ownerChannelId: ID
        claimStatus: String
        contractNo: String
        cooperationStart: DateTime
        cooperationEnd: DateTime
        commissionRate: Int
        source: String
        settlementType: String
        bankName: String
        bankAccountName: String
        bankAccountNo: String
        taxNo: String
        invoiceTitle: String
        status: String
        statusReason: String
        closedAt: DateTime
    }

    input CreateMerchantStoreInput {
        merchantId: ID!
        code: String!
        name: String!
        storeType: String
        sortOrder: Int
        weight: Int
        country: String
        province: String
        city: String
        cityCode: String
        district: String
        street: String
        addressLine: String
        detail: String
        postalCode: String
        lat: Float
        lng: Float
        coordinateSystem: String
        geohash: String
        mapPoiId: String
        mapProvider: String
        navigationAddress: String
        phoneNumber: String
        backupPhone: String
        managerName: String
        managerPhone: String
        wechat: String
        servicePhone: String
        businessHours: String
        businessHoursText: String
        timezone: String
        specialDates: String
        holidayPlan: String
        status: String
        statusNote: String
        reopenAt: DateTime
        acceptingOrders: Boolean
        coverImage: String
        photos: [String!]
        videos: [String!]
        panoramaUrl: String
        notice: String
        tags: [String!]
        facilities: [String!]
        supportsRedemption: Boolean
        redemptionHours: String
        dailyRedeemLimit: Int
        requiresReservation: Boolean
        reservationPhone: String
        supportsDelivery: Boolean
        deliveryRadiusKm: Int
        deliveryFee: Int
        minOrderAmount: Int
        deliveryMinutes: Int
        externalIds: String
        source: String
        lastSyncAt: DateTime
        isPublic: Boolean
        enabled: Boolean
        createdBy: String
        updatedBy: String
    }

    input UpdateMerchantStoreInput {
        id: ID!
        merchantId: ID
        code: String
        name: String
        storeType: String
        sortOrder: Int
        weight: Int
        country: String
        province: String
        city: String
        cityCode: String
        district: String
        street: String
        addressLine: String
        detail: String
        postalCode: String
        lat: Float
        lng: Float
        coordinateSystem: String
        geohash: String
        mapPoiId: String
        mapProvider: String
        navigationAddress: String
        phoneNumber: String
        backupPhone: String
        managerName: String
        managerPhone: String
        wechat: String
        servicePhone: String
        businessHours: String
        businessHoursText: String
        timezone: String
        specialDates: String
        holidayPlan: String
        status: String
        statusNote: String
        reopenAt: DateTime
        acceptingOrders: Boolean
        coverImage: String
        photos: [String!]
        videos: [String!]
        panoramaUrl: String
        notice: String
        tags: [String!]
        facilities: [String!]
        supportsRedemption: Boolean
        redemptionHours: String
        dailyRedeemLimit: Int
        requiresReservation: Boolean
        reservationPhone: String
        supportsDelivery: Boolean
        deliveryRadiusKm: Int
        deliveryFee: Int
        minOrderAmount: Int
        deliveryMinutes: Int
        externalIds: String
        source: String
        lastSyncAt: DateTime
        isPublic: Boolean
        enabled: Boolean
        createdBy: String
        updatedBy: String
        deletedAt: DateTime
    }

    input UpsertMerchantStoreStaffInput {
        storeId: ID!
        userId: ID!
        name: String
        phone: String
        role: String
        status: String
        lastLoginAt: DateTime
    }

    extend type Query {
        merchants(options: MerchantListOptions): MerchantList!
        merchant(id: ID!): Merchant
        merchantStores(options: MerchantStoreListOptions): MerchantStoreList!
        merchantStore(id: ID!): MerchantStore
        merchantStoreClaims(storeId: ID!): [MerchantStoreChannel!]!
        merchantStoreStaff(storeId: ID!): [MerchantStoreStaff!]!
    }

    extend type Mutation {
        createMerchant(input: CreateMerchantInput!): Merchant!
        updateMerchant(input: UpdateMerchantInput!): Merchant!
        createMerchantStore(input: CreateMerchantStoreInput!): MerchantStore!
        updateMerchantStore(input: UpdateMerchantStoreInput!): MerchantStore!
        claimMerchantStore(storeId: ID!, channelId: ID!, role: String, contractNo: String): MerchantStoreChannel!
        revokeMerchantStoreClaim(storeId: ID!, channelId: ID!): Boolean!
        upsertMerchantStoreStaff(input: UpsertMerchantStoreStaffInput!): MerchantStoreStaff!
    }
`;

const shopSchema = gql`
    type MerchantCoordinates {
        lat: Float!
        lng: Float!
    }

    type MerchantStorePublic {
        id: ID!
        merchantId: ID!
        merchantName: String!
        name: String!
        storeType: String!
        status: String!
        address: String!
        province: String
        city: String
        district: String
        phoneNumber: String
        backupPhone: String
        businessHoursText: String
        businessHours: String
        coordinates: MerchantCoordinates
        photos: [String!]!
        coverImage: String
        notice: String
        isOpenNow: Boolean!
        distanceKm: Float
        mapPoiId: String
    }

    extend type Query {
        merchantStores(lat: Float, lng: Float, city: String, merchantId: ID, limit: Int): [MerchantStorePublic!]!
        merchantStorePublic(id: ID!): MerchantStorePublic
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Merchant, MerchantStore, MerchantStoreChannel, MerchantStoreStaff],
    providers: [MerchantStoreService, CreateMerchantTablesMigration],
    exports: [MerchantStoreService],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [MerchantAdminResolver, MerchantFieldResolver, MerchantStoreFieldResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [MerchantShopResolver],
    },
    compatibility: '^3.0.0',
})
export class MerchantPlugin {
    static init(): Type<MerchantPlugin> {
        return MerchantPlugin;
    }
}
