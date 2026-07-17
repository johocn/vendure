import { Inject, MiddlewareConsumer, NestModule, OnApplicationBootstrap, Type } from '@nestjs/common';
import { I18nService, Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { APP_GUARD, ModuleRef } from '@nestjs/core';

import { CJK_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { codPaymentHandler } from './payment/cod-handler';
import { couponStackableCondition } from './promotion/coupon-stackable-condition';
import { promotionCustomFields } from './promotion/promotion-custom-fields';
import {
    storePickupCalculator,
    pickupPointCalculator,
    employeePickupCalculator,
} from './pickup/pickup-calculator';
import {
    storePickupEligibilityChecker,
    pickupPointEligibilityChecker,
    employeePickupEligibilityChecker,
} from './pickup/pickup-eligibility-checker';
import {
    storePickupFulfillmentHandler,
    pickupPointFulfillmentHandler,
    employeePickupFulfillmentHandler,
} from './pickup/pickup-fulfillment-handler';
import { PickupLocation } from './pickup/pickup-location.entity';
import { PickupLocationAdminResolver } from './pickup/pickup-location-admin.resolver';
import { PickupLocationShopResolver } from './pickup/pickup-location-shop.resolver';
import { PickupShopResolver } from './pickup/pickup-shop.resolver';
import { PickupLocationService } from './pickup/pickup-location.service';
import { pickupPermissionDefinitions } from './pickup/pickup-permissions';
import { EmployeeCustomer } from './pickup/enterprise-customer/enterprise-customer.entity';
import { EmployeeCustomerService } from './pickup/enterprise-customer/enterprise-customer.service';
import { EmployeeCustomerAdminResolver } from './pickup/enterprise-customer/enterprise-customer-admin.resolver';
import { orderCustomFields } from './order/order-custom-fields';
import { customerCustomFields } from './customer/customer-custom-fields';
import { tenantChannelCustomFields } from './tenant/tenant-channel-custom-fields';
import { TenantSetupService } from './tenant/tenant-setup.service';
import { CjkPluginOptions } from './types';
import { AuthShopResolver } from './auth/auth-shop.resolver';
import { AuthAdminResolver } from './auth/auth-admin.resolver';
import { AuthMethodGuard } from './auth/auth-method-guard';
import { SsoAuthenticationStrategy } from './auth/sso-authentication-strategy';
import { setAuthSecret } from './auth/crypto';
import { DomainResolverService } from './tenant/domain-resolver.service';
import { DomainShopResolver } from './tenant/domain-shop.resolver';
import { MapProviderRegistry } from './map/map-provider-registry';
import { MapService } from './map/map.service';
import { MapAdminResolver } from './map/map-admin.resolver';
import { MapConfigEncryptionMigration, PayConfigEncryptionMigration } from './migrations';
import { AuthConfigService } from './auth/auth-config.service';
import { PayConfigService } from './payment/pay-config.service';
import { MapConfigService } from './map/map-config.service';
import { SsoProviderService } from './auth/sso-provider.service';
import { InviteCodeService } from './auth/invite-code.service';
import { tenantConfigPermission } from './admin/tenant-config-permissions';
import { TenantConfigAdminResolver } from './admin/tenant-config-admin.resolver';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [PickupLocation, EmployeeCustomer],
    providers: [
        { provide: CJK_PLUGIN_OPTIONS, useFactory: () => CjkPlugin.options },
        TenantSetupService,
        PickupLocationService,
        EmployeeCustomerService,
        DomainResolverService,
        MapProviderRegistry,
        MapService,
        { provide: APP_GUARD, useClass: AuthMethodGuard },
        MapConfigEncryptionMigration,
        PayConfigEncryptionMigration,
        AuthConfigService,
        PayConfigService,
        MapConfigService,
        SsoProviderService,
        InviteCodeService,
    ],
    adminApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                enum PickupLocationType {
                    store
                    point
                    employee
                }

                type PickupLocation implements Node {
                    id: ID!
                    name: String!
                    type: PickupLocationType!
                    address: String!
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    isPublic: Boolean!
                    ownerChannelId: ID
                    province: String
                    city: String
                    district: String
                    street: String
                }

                type PickupLocationList implements PaginatedList {
                    items: [PickupLocation!]!
                    totalItems: Int!
                }

                input CreatePickupLocationInput {
                    name: String!
                    type: PickupLocationType!
                    address: String!
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    isPublic: Boolean
                    province: String
                    city: String
                    district: String
                    street: String
                }

                input UpdatePickupLocationInput {
                    id: ID!
                    name: String
                    type: PickupLocationType
                    address: String
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    isPublic: Boolean
                    province: String
                    city: String
                    district: String
                    street: String
                }

                input PickupLocationListOptions

                extend type Query {
                    pickupLocations(options: PickupLocationListOptions): PickupLocationList!
                    pickupLocation(id: ID!): PickupLocation
                }

                extend type Mutation {
                    createPickupLocation(input: CreatePickupLocationInput!): PickupLocation!
                    updatePickupLocation(input: UpdatePickupLocationInput!): PickupLocation!
                    deletePickupLocation(id: ID!): Boolean!
                    promotePickupLocationToPublic(id: ID!): PickupLocation!
                    assignPickupLocationsToChannel(ids: [ID!]!): Boolean!
                    removePickupLocationsFromChannel(ids: [ID!]!): Boolean!
                }

                type EmployeeCustomer implements Node {
                    id: ID!
                    customer: Customer!
                    enterpriseName: String!
                    employeeId: String
                    pickupLocations: [PickupLocation!]!
                    channel: Channel!
                    verified: Boolean!
                    createdAt: DateTime!
                }

                input CreateEmployeeCustomerInput {
                    customerId: ID!
                    enterpriseName: String!
                    employeeId: String
                    pickupLocationIds: [ID!]!
                    verified: Boolean
                }

                input UpdateEmployeeCustomerInput {
                    id: ID!
                    enterpriseName: String
                    employeeId: String
                    pickupLocationIds: [ID!]
                    verified: Boolean
                }

                extend type Query {
                    employeeCustomers: [EmployeeCustomer!]!
                    employeeCustomer(id: ID!): EmployeeCustomer
                    employeeCustomersByCustomer(customerId: ID!): [EmployeeCustomer!]!
                }

                extend type Mutation {
                    createEmployeeCustomer(input: CreateEmployeeCustomerInput!): EmployeeCustomer!
                    updateEmployeeCustomer(input: UpdateEmployeeCustomerInput!): EmployeeCustomer!
                    deleteEmployeeCustomer(id: ID!): Boolean!
                    bindEnterprisePickupLocations(id: ID!, pickupLocationIds: [ID!]!): EmployeeCustomer!
                    verifyEmployeeCustomer(id: ID!): EmployeeCustomer!
                }

                extend type Query {
                    channelAuthConfig(channelId: ID!): TenantAuthConfigMasked
                }

                extend type Mutation {
                    updateChannelAuthConfig(channelId: ID!, input: JSON!): Boolean!
                }

                type TenantAuthConfigMasked {
                    enabledMethods: [String!]!
                    overrides: JSON
                    ssoProviders: [SsoProviderMasked!]!
                }

                type SsoProviderMasked {
                    name: String!
                    providerKey: String!
                    protocol: String!
                    baseUrl: String!
                    authorizeUrl: String
                    tokenUrl: String
                    userInfoUrl: String
                    clientId: String!
                    clientSecret: String!
                    scopes: [String!]!
                    channelCode: String
                    userInfoMapping: JSON
                }

                type DistrictNode {
                    adcode: String!
                    name: String!
                    level: String!
                    center: LatLng!
                }

                type ReverseGeocodeResult {
                    province: String
                    city: String
                    district: String
                    street: String
                    formattedAddress: String!
                }

                type MapSdkConfig {
                    provider: String!
                    sdkUrl: String!
                    hasConfigured: Boolean!
                }

                type ChannelMapConfig {
                    provider: String!
                    apiKey: String!
                    hasConfigured: Boolean!
                }

                type LatLng {
                    lat: Float!
                    lng: Float!
                }

                extend type Query {
                    mapDistricts(parentAdcode: String): [DistrictNode!]!
                    reverseGeocode(lat: Float!, lng: Float!): ReverseGeocodeResult!
                    mapSdkConfig: MapSdkConfig!
                    channelMapConfig(channelId: ID!): ChannelMapConfig!
                }

                extend type Query {
                    tenantConfig(channelId: ID!): TenantConfigPayload!
                }

                extend type Mutation {
                    updateTenantConfig(input: UpdateTenantConfigInput!): TenantConfigPayload!
                    testSsoConnection(input: TestSsoInput!): TestSsoResult!
                }

                type TenantConfigPayload {
                    channelId: ID!
                    auth: JSON
                    pay: JSON
                    map: JSON
                    canEdit: Boolean!
                }

                input UpdateTenantConfigInput {
                    channelId: ID!
                    authPatch: JSON
                    payPatch: JSON
                    mapPatch: JSON
                }

                input TestSsoInput {
                    channelId: ID!
                    providerKey: String!
                    newClientSecret: String
                }

                type TestSsoResult {
                    success: Boolean!
                    latencyMs: Int!
                    error: String
                }
            `;
        },
        resolvers: [PickupLocationAdminResolver, EmployeeCustomerAdminResolver, AuthAdminResolver, MapAdminResolver, TenantConfigAdminResolver],
    },
    shopApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                extend type Query {
                    pickupLocations(type: String, lat: Float, lng: Float): [PickupLocation!]!
                    employeePickupLocations(lat: Float, lng: Float): [PickupLocation!]!
                }

                extend type Mutation {
                    setOrderPickupLocation(pickupLocationId: ID!, pickupType: String!): Order!
                }

                type PickupLocation {
                    id: ID!
                    name: String!
                    type: String!
                    address: String!
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    isPublic: Boolean!
                }

                type AuthMethodsResult {
                    methods: [String!]!
                    wechatAppId: String
                }
                extend type Query {
                    authMethods: AuthMethodsResult!
                    ssoProviders: [SsoProviderInfo!]!
                }

                type SsoProviderInfo {
                    name: String!
                    providerKey: String!
                    protocol: String!
                    baseUrl: String!
                    authorizeUrl: String
                    clientId: String!
                    scopes: [String!]!
                    channelCode: String
                }

                type DomainResolveResult {
                    token: String!
                    code: String!
                }
                extend type Query {
                    resolveChannelByDomain(host: String!): DomainResolveResult
                }
            `;
        },
        resolvers: [PickupLocationShopResolver, PickupShopResolver, AuthShopResolver, DomainShopResolver],
    },
    configuration: config => {
        // 注入 authSecret 到 crypto 模块（configuration 在 bootstrap 早期执行，此时 options 已可用）
        setAuthSecret(CjkPlugin.options.authSecret);

        // 注册 SSO 策略到 shop 端（init 钩子由 Vendure 自动调用）
        config.authOptions = config.authOptions || {};
        config.authOptions.shopAuthenticationStrategy = [
            ...(config.authOptions.shopAuthenticationStrategy || []),
            new SsoAuthenticationStrategy(),
        ];

        if (CjkPlugin.options.cod?.enabled) {
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                codPaymentHandler,
            ];
        }

        const hasPickup = CjkPlugin.options.storePickup?.enabled
            || CjkPlugin.options.pickupPoint?.enabled
            || CjkPlugin.options.employeePickup?.enabled;
        if (hasPickup) {
            config.shippingOptions = config.shippingOptions || {};
            config.shippingOptions.shippingEligibilityCheckers = [
                ...(config.shippingOptions.shippingEligibilityCheckers || []),
            ];
            config.shippingOptions.shippingCalculators = [
                ...(config.shippingOptions.shippingCalculators || []),
            ];
            config.shippingOptions.fulfillmentHandlers = [
                ...(config.shippingOptions.fulfillmentHandlers || []),
            ];

            if (CjkPlugin.options.storePickup?.enabled) {
                config.shippingOptions.shippingEligibilityCheckers!.push(storePickupEligibilityChecker);
                config.shippingOptions.shippingCalculators!.push(storePickupCalculator);
                config.shippingOptions.fulfillmentHandlers!.push(storePickupFulfillmentHandler);
            }

            if (CjkPlugin.options.pickupPoint?.enabled) {
                config.shippingOptions.shippingEligibilityCheckers!.push(pickupPointEligibilityChecker);
                config.shippingOptions.shippingCalculators!.push(pickupPointCalculator);
                config.shippingOptions.fulfillmentHandlers!.push(pickupPointFulfillmentHandler);
            }

            if (CjkPlugin.options.employeePickup?.enabled) {
                config.shippingOptions.shippingEligibilityCheckers!.push(employeePickupEligibilityChecker);
                config.shippingOptions.shippingCalculators!.push(employeePickupCalculator);
                config.shippingOptions.fulfillmentHandlers!.push(employeePickupFulfillmentHandler);
            }
        }

        if (CjkPlugin.options.promotionPolicy?.enabled) {
            config.promotionOptions = config.promotionOptions || {};
            config.promotionOptions.promotionConditions = [
                ...(config.promotionOptions.promotionConditions || []),
                couponStackableCondition,
            ];

            config.customFields = {
                ...config.customFields,
                Promotion: [
                    ...(config.customFields?.Promotion || []),
                    ...promotionCustomFields.Promotion!,
                ],
            };
        }

        if (CjkPlugin.options.tenant?.enabled) {
            config.customFields = {
                ...config.customFields,
                Channel: [
                    ...(config.customFields?.Channel || []),
                    ...tenantChannelCustomFields.Channel!,
                ],
            };
        }

        // 注册 Order customFields（selectedPickupLocationId、pickupType）
        config.customFields = {
            ...config.customFields,
            Order: [
                ...(config.customFields?.Order || []),
                ...orderCustomFields.Order!,
            ],
        };

        config.customFields = {
            ...config.customFields,
            Customer: [
                ...(config.customFields?.Customer || []),
                ...customerCustomFields.Customer!,
            ],
        };

        // 注册自定义权限（PickupPermissions）
        config.authOptions = config.authOptions || {};
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...pickupPermissionDefinitions,
        ];

        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            tenantConfigPermission,
        ];

        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class CjkPlugin implements OnApplicationBootstrap, NestModule {
    private static options: CjkPluginOptions;

    constructor(
        @Inject(CJK_PLUGIN_OPTIONS) private options: CjkPluginOptions,
        private moduleRef: ModuleRef,
    ) {}

    static init(options: CjkPluginOptions): Type<CjkPlugin> {
        CjkPlugin.options = options;
        return CjkPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        const injector = new Injector(this.moduleRef);
        if (this.options.i18n?.enabled !== false) {
            const i18nService = injector.get(I18nService);
            const languages = this.options.i18n?.languages || ['zh_Hans', 'zh_Hant', 'ja', 'ko'];
            const translations: Record<string, any> = {
                zh_Hans: require('./i18n/zh_CN.json'),
                zh_Hant: require('./i18n/zh_TW.json'),
                ja: require('./i18n/ja.json'),
                ko: require('./i18n/ko.json'),
            };
            for (const lang of languages) {
                if (translations[lang]) {
                    i18nService.addTranslation(lang, translations[lang]);
                    Logger.info(`Registered i18n translation for ${lang}`, loggerCtx);
                }
            }
        }

        if (this.options.regions?.enabled !== false) {
            Logger.info('CJK regions module enabled - use RegionPopulator in your server bootstrap to populate countries', loggerCtx);
        }

        if (this.options.cod?.enabled) {
            Logger.info('Cash on Delivery payment module enabled', loggerCtx);
        }

        if (this.options.storePickup?.enabled) {
            Logger.info('Store pickup shipping module enabled', loggerCtx);
        }

        if (this.options.pickupPoint?.enabled) {
            Logger.info('Pickup point shipping module enabled', loggerCtx);
        }

        if (this.options.employeePickup?.enabled) {
            Logger.info('Employee pickup shipping module enabled', loggerCtx);
        }

        if (this.options.promotionPolicy?.enabled) {
            Logger.info('Promotion stacking policy module enabled', loggerCtx);
        }

        if (this.options.tenant?.enabled) {
            Logger.info('Tenant (multi-channel) module enabled', loggerCtx);
        }
    }

    configure(consumer: MiddlewareConsumer): void {}
}
