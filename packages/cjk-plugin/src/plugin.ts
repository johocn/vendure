import { Inject, MiddlewareConsumer, NestModule, OnApplicationBootstrap, Type } from '@nestjs/common';
import { I18nService, Injector, Logger, PluginCommonModule, RequestContext, VendurePlugin } from '@vendure/core';
import { APP_GUARD, ModuleRef } from '@nestjs/core';

import { CJK_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { codPaymentHandler } from './payment/cod-handler';
import { aggregatePaymentHandler } from './payment/aggregate-payment-handler';
import { fixedAggregateCollectionHandler } from './payment/fixed-aggregate-collection-handler';
import { couponStackableCondition } from './promotion/coupon-stackable-condition';
import { promotionCustomFields } from './promotion/promotion-custom-fields';
import {
    storePickupCalculator,
    pickupPointCalculator,
    employeePickupCalculator,
    localDeliveryCalculator,
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
import { pickupLocationPermissionDefinitions } from './pickup/pickup-location-permissions';
import { EmployeeCustomer } from './pickup/enterprise-customer/enterprise-customer.entity';
import { EmployeeCustomerService } from './pickup/enterprise-customer/enterprise-customer.service';
import { EmployeeCustomerAdminResolver } from './pickup/enterprise-customer/enterprise-customer-admin.resolver';
import { orderCustomFields } from './order/order-custom-fields';
import { customerCustomFields } from './customer/customer-custom-fields';
import { tenantChannelCustomFields } from './tenant/tenant-channel-custom-fields';
import { productVariantCustomFields } from './shipping/product-variant-custom-fields';
import { customShippingMethodFields } from './shipping/shipping-method-custom-fields';
import { tieredWeightShippingCalculator, tieredQuantityShippingCalculator } from './shipping/tiered-shipping-calculator';
import { tieredShippingEligibilityChecker } from './shipping/tiered-shipping-eligibility-checker';
import { ShippingTemplate } from './shipping/shipping-template.entity';
import { ShippingTemplateService } from './shipping/shipping-template.service';
import { ShippingTemplateAdminResolver } from './shipping/shipping-template-admin.resolver';
import { shippingTemplatePermissionDefinitions } from './shipping/shipping-template-permissions';
import { TenantSetupService } from './tenant/tenant-setup.service';
import { TenantMember } from './tenant/tenant-member.entity';
import { tenantPermissionDefinitions } from './tenant/tenant-permissions';
import { TenantMemberService } from './tenant/tenant-member.service';
import { TenantAdminResolver } from './tenant/tenant-admin.resolver';
import { TenantMemberResolver } from './tenant/tenant-member.resolver';
import { MyAccessResolver } from './tenant/my-access.resolver';
import { CjkPluginOptions } from './types';
import { AuthShopResolver } from './auth/auth-shop.resolver';
import { AuthAdminResolver } from './auth/auth-admin.resolver';
import { AuthMethodGuard } from './auth/auth-method-guard';
import { TenantEnabledGuard } from './auth/tenant-enabled.guard';
import { ssoAuthenticationStrategy } from './auth/sso-authentication-strategy';
import { setAuthSecret } from './auth/crypto';
import { DomainResolverService } from './tenant/domain-resolver.service';
import { DomainShopResolver } from './tenant/domain-shop.resolver';
import { MapProviderRegistry } from './map/map-provider-registry';
import { MapService } from './map/map.service';
import { MapAdminResolver } from './map/map-admin.resolver';
import { MapShopResolver } from './map/map-shop.resolver';
import { MapConfigEncryptionMigration, PayConfigEncryptionMigration, TenantMemberColumnMigration, ChannelCustomColumnMigration } from './migrations';
import { AuthConfigService } from './auth/auth-config.service';
import { PayConfigService } from './payment/pay-config.service';
import { MapConfigService } from './map/map-config.service';
import { SsoProviderService } from './auth/sso-provider.service';
import { InviteCodeService } from './auth/invite-code.service';
import { tenantConfigPermission } from './admin/tenant-config-permissions';
import { TenantConfigAdminResolver } from './admin/tenant-config-admin.resolver';
import { ShippingProfile } from './shipping/shipping-profile.entity';
import { ShippingProfileMethod } from './shipping/shipping-profile-method.entity';
import { ShippingProfileService } from './shipping/shipping-profile.service';
import { ShippingProfileAdminResolver } from './shipping/shipping-profile-admin.resolver';
import { shippingProfilePermission, shippingProfilePermissionDefinitions } from './shipping/shipping-profile-permissions';
import { PaymentProfile } from './payment/payment-profile.entity';
import { PaymentProfileMethod } from './payment/payment-profile-method.entity';
import { PaymentProfileService } from './payment/payment-profile.service';
import { PaymentProfileAdminResolver } from './payment/payment-profile-admin.resolver';
import { paymentProfilePermission, paymentProfilePermissionDefinitions } from './payment/payment-profile-permissions';
import { PaymentTemplate } from './payment/payment-template.entity';
import { PaymentTemplateService } from './payment/payment-template.service';
import { PaymentTemplateAdminResolver } from './payment/payment-template-admin.resolver';
import { paymentTemplatePermissionDefinitions } from './payment/payment-template-permissions';
import { ShippingProfileShopResolver } from './shipping/shipping-profile-shop.resolver';
import { PaymentProfileShopResolver } from './payment/payment-profile-shop.resolver';
import { OrderBoxService } from './order/order-box.service';
import { OrderBoxShopResolver } from './order/order-box-shop.resolver';
import { OrderSplitService } from './order/order-split.service';
import { OrderSplitShopResolver } from './order/order-split-shop.resolver';
import { BoxShippingLineAssignmentStrategy } from './shipping/box-shipping-line-assignment-strategy';
import { ChannelEvent, EventBus, OrderEvent, OrderService, TransactionalConnection } from '@vendure/core';
import { DefaultDataService } from './seed/default-data.service';
import { Wallet } from './wallet/wallet.entity';
import { WalletService } from './wallet/wallet.service';
import { WalletAdminResolver } from './wallet/wallet-admin.resolver';
import { WalletShopResolver } from './wallet/wallet-shop.resolver';
import { balanceWalletPaymentHandler, setWalletService } from './wallet/balance-wallet-payment-handler';
import { TenantCatalogService } from './tenant/tenant-catalog.service';
import { TenantCatalogAdminResolver } from './tenant/tenant-catalog-admin.resolver';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [PickupLocation, EmployeeCustomer, ShippingTemplate, ShippingProfile, PaymentProfile, ShippingProfileMethod, PaymentProfileMethod, PaymentTemplate, TenantMember, Wallet],
    providers: [
        { provide: CJK_PLUGIN_OPTIONS, useFactory: () => CjkPlugin.options },
        TenantSetupService,
        PickupLocationService,
        EmployeeCustomerService,
        DomainResolverService,
        MapProviderRegistry,
        MapService,
        { provide: APP_GUARD, useClass: AuthMethodGuard },
        { provide: APP_GUARD, useClass: TenantEnabledGuard },
        MapConfigEncryptionMigration,
        PayConfigEncryptionMigration,
        TenantMemberColumnMigration,
        ChannelCustomColumnMigration,
        AuthConfigService,
        PayConfigService,
        MapConfigService,
        SsoProviderService,
        InviteCodeService,
        ShippingTemplateService,
        ShippingProfileService,
        PaymentProfileService,
        PaymentTemplateService,
        DefaultDataService,
        TenantMemberService,
        OrderBoxService,
        OrderSplitService,
        WalletService,
        TenantCatalogService,
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
                    contactPerson: String
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    photos: JSON
                    remark: String
                    sortOrder: Int!
                    enabled: Boolean!
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
                    contactPerson: String
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    photos: JSON
                    remark: String
                    sortOrder: Int
                    enabled: Boolean
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
                    contactPerson: String
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    photos: JSON
                    remark: String
                    sortOrder: Int
                    enabled: Boolean
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
                    updateChannelAuthConfig(channelId: ID!, input: JSON!): TenantAuthConfigMasked!
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

                # ===== Shipping Template =====
                # checker/calculator 为 ConfigurableOperation 形态（code + arguments），
                # 与 Vendure 内置 ConfigArg（仅 name/value）不同，故定义独立只读类型
                type TemplateOperation {
                    code: String!
                    arguments: [ConfigArg!]!
                }

                type ShippingTemplate {
                    id: ID!
                    name: String!
                    description: String!
                    code: String!
                    fulfillmentHandler: String!
                    checker: TemplateOperation
                    calculator: TemplateOperation
                    isGlobal: Boolean!
                }

                type ShippingTemplateList {
                    items: [ShippingTemplate!]!
                    totalItems: Int!
                }

                input ShippingTemplateListOptions {
                    skip: Int
                    take: Int
                    sort: JSON
                    filter: JSON
                }

                input CreateShippingTemplateInput {
                    name: String!
                    description: String!
                    code: String!
                    fulfillmentHandler: String!
                    checker: ConfigArgInput!
                    calculator: ConfigArgInput!
                    isGlobal: Boolean
                }

                input UpdateShippingTemplateInput {
                    id: ID!
                    name: String
                    description: String
                    code: String
                    fulfillmentHandler: String
                    checker: ConfigArgInput
                    calculator: ConfigArgInput
                }

                extend type Query {
                    shippingTemplates(options: ShippingTemplateListOptions): ShippingTemplateList!
                    shippingTemplate(id: ID!): ShippingTemplate
                }

                extend type Mutation {
                    createShippingTemplate(input: CreateShippingTemplateInput!): ShippingTemplate!
                    updateShippingTemplate(input: UpdateShippingTemplateInput!): ShippingTemplate!
                    deleteShippingTemplate(id: ID!): Boolean!
                    createShippingMethodFromTemplate(templateId: ID!, name: String, code: String): ShippingMethod!
                    updateShippingMethodShippingPrice(id: ID!, shippingPrice: Int!): ShippingMethod!
                }

                # ===== Shipping Profile =====
                type ShippingProfile implements Node {
                    id: ID!
                    name: String!
                    description: String!
                    code: String!
                    isGlobal: Boolean!
                    freeShippingThreshold: Int
                    shippingMethods: [ShippingMethod!]!
                    pickupLocations: [PickupLocation!]!
                    isTenantDefault: Boolean!
                    enabled: Boolean!
                    methodConfigs: [ShippingProfileMethodConfig!]!
                    paymentProfileId: ID
                }

                type ShippingProfileMethodConfig {
                    shippingMethodId: ID!
                    mode: String!
                    options: JSON
                }

                input ShippingProfileMethodConfigInput {
                    shippingMethodId: ID!
                    mode: String!
                    options: JSON
                }

                type ShippingProfileList implements PaginatedList {
                    items: [ShippingProfile!]!
                    totalItems: Int!
                }

                input CreateShippingProfileInput {
                    name: String!
                    code: String!
                    description: String
                    isGlobal: Boolean
                    enabled: Boolean
                    freeShippingThreshold: Int
                    shippingMethodIds: [ID!]!
                    pickupLocationIds: [ID!]
                    methodConfigs: [ShippingProfileMethodConfigInput!]
                    paymentProfileId: ID
                }

                input UpdateShippingProfileInput {
                    id: ID!
                    name: String
                    code: String
                    description: String
                    isGlobal: Boolean
                    enabled: Boolean
                    freeShippingThreshold: Int
                    shippingMethodIds: [ID!]
                    pickupLocationIds: [ID!]
                    methodConfigs: [ShippingProfileMethodConfigInput!]
                    paymentProfileId: ID
                }

                input ShippingProfileListOptions {
                    skip: Int
                    take: Int
                    sort: JSON
                    filter: JSON
                }

                extend type Query {
                    shippingProfiles(options: ShippingProfileListOptions): ShippingProfileList!
                    shippingProfile(id: ID!): ShippingProfile
                }

                extend type Mutation {
                    createShippingProfile(input: CreateShippingProfileInput!): ShippingProfile!
                    updateShippingProfile(input: UpdateShippingProfileInput!): ShippingProfile!
                    deleteShippingProfile(id: ID!): Boolean!
                    assignShippingProfile(variantIds: [ID!]!, profileId: ID!): Boolean!
                    setTenantDefaultShippingProfile(id: ID!): Boolean!
                }

                # ===== Payment Profile =====
                type PaymentProfile implements Node {
                    id: ID!
                    name: String!
                    description: String!
                    code: String!
                    isGlobal: Boolean!
                    installmentOptions: JSON
                    paymentMethods: [PaymentMethod!]!
                    isTenantDefault: Boolean!
                    enabled: Boolean!
                    methodConfigs: [PaymentProfileMethodConfig!]!
                }

                type PaymentProfileMethodConfig {
                    paymentMethodId: ID!
                    mode: String!
                    options: JSON
                }

                input PaymentProfileMethodConfigInput {
                    paymentMethodId: ID!
                    mode: String!
                    options: JSON
                }

                type PaymentProfileList implements PaginatedList {
                    items: [PaymentProfile!]!
                    totalItems: Int!
                }

                input CreatePaymentProfileInput {
                    name: String!
                    code: String!
                    description: String
                    isGlobal: Boolean
                    enabled: Boolean
                    installmentOptions: JSON
                    paymentMethodIds: [ID!]!
                    methodConfigs: [PaymentProfileMethodConfigInput!]
                }

                input UpdatePaymentProfileInput {
                    id: ID!
                    name: String
                    code: String
                    description: String
                    isGlobal: Boolean
                    enabled: Boolean
                    installmentOptions: JSON
                    paymentMethodIds: [ID!]
                    methodConfigs: [PaymentProfileMethodConfigInput!]
                }

                input PaymentProfileListOptions {
                    skip: Int
                    take: Int
                    sort: JSON
                    filter: JSON
                }

                extend type Query {
                    paymentProfiles(options: PaymentProfileListOptions): PaymentProfileList!
                    paymentProfile(id: ID!): PaymentProfile
                }

                extend type Mutation {
                    createPaymentProfile(input: CreatePaymentProfileInput!): PaymentProfile!
                    updatePaymentProfile(input: UpdatePaymentProfileInput!): PaymentProfile!
                    deletePaymentProfile(id: ID!): Boolean!
                    assignPaymentProfile(variantIds: [ID!]!, profileId: ID!): Boolean!
                    setTenantDefaultPaymentProfile(id: ID!): Boolean!
                }

                # ===== Payment Template =====
                type PaymentTemplate {
                    id: ID!
                    name: String!
                    description: String!
                    code: String!
                    handler: ConfigArg!
                    checker: ConfigArg
                    isGlobal: Boolean!
                }

                type PaymentTemplateList {
                    items: [PaymentTemplate!]!
                    totalItems: Int!
                }

                input PaymentTemplateListOptions {
                    skip: Int
                    take: Int
                    sort: JSON
                    filter: JSON
                }

                input CreatePaymentTemplateInput {
                    name: String!
                    description: String!
                    code: String!
                    handler: ConfigArgInput!
                    checker: ConfigArgInput
                    isGlobal: Boolean
                }

                input UpdatePaymentTemplateInput {
                    id: ID!
                    name: String
                    description: String
                    code: String
                    handler: ConfigArgInput
                    checker: ConfigArgInput
                }

                extend type Query {
                    paymentTemplates(options: PaymentTemplateListOptions): PaymentTemplateList!
                    paymentTemplate(id: ID!): PaymentTemplate
                }

                extend type Mutation {
                    createPaymentTemplate(input: CreatePaymentTemplateInput!): PaymentTemplate!
                    updatePaymentTemplate(input: UpdatePaymentTemplateInput!): PaymentTemplate!
                    deletePaymentTemplate(id: ID!): Boolean!
                    createPaymentMethodFromTemplate(templateId: ID!, name: String, code: String): PaymentMethod!
                }

                # ===== 租户 / 角色 / 权限体系 =====
                type TenantMember implements Node {
                    id: ID!
                    administratorId: ID!
                    channelId: ID!
                    enabled: Boolean!
                    mustChangePassword: Boolean!
                    displayName: String
                    remark: String
                    phone: String
                    roleIds: [ID!]!
                    createdAt: DateTime!
                    initialPassword: String
                }

                input CreateTenantInput {
                    name: String!
                    token: String
                    isOfficial: Boolean
                }

                input UpdateTenantInput {
                    name: String
                    tenantNo: Int
                    isOfficial: Boolean
                }

                input TenantListOptions {
                    skip: Int
                    take: Int
                    filter: JSON
                }

                input CreateTenantAdministratorInput {
                    firstName: String
                    lastName: String
                    emailAddress: String!
                    password: String
                    roleIds: [ID!]!
                    displayName: String
                    remark: String
                    phone: String
                    enabled: Boolean
                    forcePasswordChange: Boolean
                }

                input CreateTenantRoleInput {
                    code: String!
                    description: String!
                    permissions: [String!]!
                }

                input UpdateTenantRoleInput {
                    code: String
                    description: String
                    permissions: [String!]
                }

                input CreateTenantMemberInput {
                    firstName: String
                    lastName: String
                    emailAddress: String!
                    password: String
                    roleIds: [ID!]!
                    displayName: String
                    remark: String
                    phone: String
                    enabled: Boolean
                    forcePasswordChange: Boolean
                }

                type MyTenantChannel {
                    id: ID!
                    code: String!
                    token: String!
                    name: String!
                    enabled: Boolean!
                    tenantNo: Int
                    isOfficial: Boolean!
                    memberEnabled: Boolean!
                    mustChangePassword: Boolean!
                }

                type MyTenantAccess {
                    isSuperAdmin: Boolean!
                    channels: [MyTenantChannel!]!
                    permissions: [String!]!
                    mustChangePassword: Boolean!
                }

                type PermissionCatalogItem {
                    code: String!
                    label: String!
                }
                type PermissionCatalogGroup {
                    key: String!
                    label: String!
                    items: [PermissionCatalogItem!]!
                }
                type RoleTemplate {
                    key: String!
                    busiPrefix: String!
                    description: String!
                    permissions: [String!]!
                }

                # 关联已有账号：平台账号搜索候选
                type TenantAdminCandidate {
                    id: ID!
                    emailAddress: String!
                    displayName: String
                    linkedCount: Int!
                    linkedChannelIds: [ID!]!
                    alreadyLinked: Boolean!
                }

                extend type Query {
                    permissionCatalog: [PermissionCatalogGroup!]
                    tenants(options: TenantListOptions): ChannelList!
                    tenant(id: ID!): Channel
                    tenantAdministrators(channelId: ID!): [TenantMember!]!
                    tenantRoles(channelId: ID!): [Role!]!
                    tenantMembers: [TenantMember!]!
                    myTenantRoles: [Role!]!
                    myTenantAccess(channelId: ID): MyTenantAccess!
                    globalRoles: [Role!]!
                    globalRoleTemplates: [RoleTemplate!]!
                    myGlobalRolesAvailable: [Role!]!
                    tenantSearchAdmins(channelId: ID!, keyword: String!): [TenantAdminCandidate!]!
                    mySearchAdmins(keyword: String!): [TenantAdminCandidate!]!
                }

                extend type Mutation {
                    createTenant(input: CreateTenantInput!): Channel!
                    updateTenant(id: ID!, input: UpdateTenantInput!): Channel!
                    setTenantEnabled(id: ID!, enabled: Boolean!): Channel!
                    deleteTenant(id: ID!): Boolean!
                    createTenantAdministrator(channelId: ID!, input: CreateTenantAdministratorInput!): TenantMember!
                    setTenantAdministratorEnabled(id: ID!, enabled: Boolean!): TenantMember!
                    deleteTenantAdministrator(id: ID!): Boolean!
                    createTenantRole(channelId: ID!, input: CreateTenantRoleInput!): Role!
                    updateTenantRole(roleId: ID!, input: UpdateTenantRoleInput!): Role!
                    deleteTenantRole(roleId: ID!): Boolean!
                    importDefaultRoles(channelId: ID!): [Role!]!
                    createGlobalRole(channelIds: [ID!]!, input: CreateTenantRoleInput!): [Role!]!
                    referGlobalRoleToChannel(roleId: ID!, channelId: ID!): Boolean!
                    unreferGlobalRoleFromChannel(roleId: ID!, channelId: ID!): Boolean!
                    myReferGlobalRole(roleId: ID!): Boolean!
                    myUnreferGlobalRole(roleId: ID!): Boolean!
                    myImportDefaultRoles: [Role!]!
                    createTenantMember(input: CreateTenantMemberInput!): TenantMember!
                    setTenantMemberEnabled(id: ID!, enabled: Boolean!): TenantMember!
                    deleteTenantMember(id: ID!): Boolean!
                    myCreateTenantRole(input: CreateTenantRoleInput!): Role!
                    myUpdateTenantRole(roleId: ID!, input: UpdateTenantRoleInput!): Role!
                    myDeleteTenantRole(roleId: ID!): Boolean!
                    updateTenantMemberRoles(id: ID!, channelId: ID!, roleIds: [ID!]!): Boolean!
                    myUpdateTenantMemberRoles(id: ID!, roleIds: [ID!]!): Boolean!
                    tenantLinkMember(channelId: ID!, administratorId: ID!, roleIds: [ID!]!, displayName: String, phone: String, remark: String): TenantMember!
                    myLinkMember(administratorId: ID!, roleIds: [ID!]!, displayName: String, phone: String, remark: String): TenantMember!
                    tenantChangeMyPassword(newPassword: String!): Boolean!
                    myUpdateChannelCustomFields(input: JSON!): JSON!
                }

                # ===== 全局共享余额钱包 =====
                type Wallet implements Node {
                    id: ID!
                    balance: Int!
                    currencyCode: String
                    createdAt: DateTime
                    updatedAt: DateTime
                }

                extend type Query {
                    wallet: Wallet!
                }

                extend type Mutation {
                    adminCreditWallet(amount: Int!): Wallet!
                    adminDebitWallet(amount: Int!): Wallet!
                }

                extend type Mutation {
                    createTenantCollection(input: CreateCollectionInput!): Collection!
                    mapProductToPlatformCollection(productId: ID!, collectionId: ID!): Boolean!
                }

                `;
        },
        resolvers: [PickupLocationAdminResolver, EmployeeCustomerAdminResolver, AuthAdminResolver, MapAdminResolver, TenantConfigAdminResolver, ShippingTemplateAdminResolver, ShippingProfileAdminResolver, PaymentProfileAdminResolver, PaymentTemplateAdminResolver, TenantAdminResolver, TenantMemberResolver, MyAccessResolver, WalletAdminResolver, TenantCatalogAdminResolver],
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
                    contactPerson: String
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    photos: JSON
                    remark: String
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

                type SsoBindResult {
                    bound: Boolean!
                    userId: ID!
                    identifier: String
                    reason: String
                }
                extend type Mutation {
                    bindSsoIdentity(providerKey: String!, code: String!, redirectUri: String): SsoBindResult!
                }

                type DomainResolveResult {
                    token: String!
                    code: String!
                }
                extend type Query {
                    resolveChannelByDomain(host: String!): DomainResolveResult
                }

                type ChannelResolveResult {
                    token: String!
                    code: String!
                    customFields: ChannelResolveCustomFields
                }
                type ChannelResolveCustomFields {
                    shopName: String
                    shopLogo: String
                    shopIntro: String
                    servicePhone: String
                    shopContent: String
                    displayTemplate: String
                    themeId: String
                }
                extend type Query {
                    resolveChannelByCode(code: String!): ChannelResolveResult
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

                type LatLng {
                    lat: Float!
                    lng: Float!
                }

                type MapSdkConfig {
                    provider: String!
                    sdkUrl: String!
                    hasConfigured: Boolean!
                }

                extend type Query {
                    mapDistricts(parentAdcode: String): [DistrictNode!]!
                    reverseGeocode(lat: Float!, lng: Float!): ReverseGeocodeResult!
                    mapSdkConfig: MapSdkConfig!
                }

                type EligibleShippingMethod {
                    id: ID!
                    code: String!
                    mode: String
                    pickupLocationIds: [ID!]
                    name: String
                }

                type EligiblePaymentMethod {
                    id: ID!
                    code: String!
                    mode: String
                    options: JSON
                    name: String
                }

                extend type Query {
                    eligibleShippingMethodsByProfile(profileIds: [ID!]!): [ShippingMethod!]!
                    eligiblePaymentMethodsByProfile(profileIds: [ID!]!): [PaymentMethod!]!
                    eligibleInstallmentOptions(profileIds: [ID!]!): JSON
                    checkShippingProfileCompatibility(profileIds: [ID!]!): ProfileCompatibilityResult!
                    checkPaymentProfileCompatibility(profileIds: [ID!]!): ProfileCompatibilityResult!
                    eligiblePickupLocationsByProfile(profileIds: [ID!]!): [PickupLocation!]!
                    checkPickupLocationConstraint(profileIds: [ID!]!): Boolean!
                    eligibleShippingMethodsWithConfig(profileIds: [ID!]!): [EligibleShippingMethod!]!
                    resolveShippingMethodsForChannel: [EligibleShippingMethod!]!
                    eligiblePaymentMethodsWithConfig(profileIds: [ID!]!): [EligiblePaymentMethod!]!
                    resolvePaymentMethodsForChannel: [EligiblePaymentMethod!]!
                }

                type ProfileCompatibilityResult {
                    compatible: Boolean!
                    intersectedCount: Int!
                }

                type OrderBox {
                    boxKey: String!
                    profileId: ID
                    profileName: String!
                    lineIds: [ID!]!
                    tenantChannelId: ID
                    shippingProfileIds: [ID!]!
                    availableShippingMethodIds: [ID!]!
                    defaultShippingMethodId: ID
                    pickupLocations: [PickupLocation!]!
                    availablePaymentMethodCodes: [String!]!
                }

                extend type Query {
                    orderBoxes: [OrderBox!]!
                }

                extend type Mutation {
                    setOrderBoxShippingMethod(boxKey: String!, shippingMethodId: ID!, pickupLocationId: ID): Order!
                    # 一次性拆单结算：内部完成拆单 + 逐单过渡 ArrangingPayment + addPaymentToOrder，
                    # 返回已结算订单列表。metadata 为支付方式透传 json 字符串。
                    checkoutSplitted(method: String!, metadata: String): [Order!]!
                }

                # ===== 全局共享余额钱包 =====
                extend type Query {
                    walletBalance: Int!
                }
            `;
        },
        resolvers: [PickupLocationShopResolver, PickupShopResolver, AuthShopResolver, DomainShopResolver, MapShopResolver, ShippingProfileShopResolver, PaymentProfileShopResolver, OrderBoxShopResolver, OrderSplitShopResolver, WalletShopResolver],
    },
    configuration: config => {
        // 注入 authSecret 到 crypto 模块（configuration 在 bootstrap 早期执行，此时 options 已可用）
        setAuthSecret(CjkPlugin.options.authSecret);

        // 注册 SSO 策略到 shop 端（init 钩子由 Vendure 自动调用）
        config.authOptions = config.authOptions || {};
        config.authOptions.shopAuthenticationStrategy = [
            ...(config.authOptions.shopAuthenticationStrategy || []),
            ssoAuthenticationStrategy, // 使用单例：resolver 经 export 访问 bindIdentityToUser
        ];

        if (CjkPlugin.options.cod?.enabled) {
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                codPaymentHandler,
            ];
        }

        // 聚合码支付（线下扫码 + 自确认），默认启用
        if (CjkPlugin.options.aggregate?.enabled !== false) {
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                aggregatePaymentHandler,
            ];
        }

        // 固定聚合码收款（门店到店收银，自确认），默认启用
        if (CjkPlugin.options.aggregate?.enabled !== false) {
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                fixedAggregateCollectionHandler,
            ];
        }

        // 全局共享余额钱包支付（跨租户/跨档案合单），默认启用
        config.paymentOptions.paymentMethodHandlers = [
            ...(config.paymentOptions.paymentMethodHandlers || []),
            balanceWalletPaymentHandler,
        ];

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

        // 阶梯重量/件数计费（始终注册，供快递配送方式使用）
        config.shippingOptions = config.shippingOptions || {};
        config.shippingOptions.shippingEligibilityCheckers = [
            ...(config.shippingOptions.shippingEligibilityCheckers || []),
            tieredShippingEligibilityChecker,
        ];
        config.shippingOptions.shippingCalculators = [
            ...(config.shippingOptions.shippingCalculators || []),
            tieredWeightShippingCalculator,
            tieredQuantityShippingCalculator,
            localDeliveryCalculator,
        ];

        // 按配送档案分箱：多配送方式时每个 ShippingLine 只挂其箱内 OrderLine，
        // 支撑「单订单内多配送组 / 多 fulfillment」。单箱场景退化为默认全量分配。
        config.shippingOptions.shippingLineAssignmentStrategy = new BoxShippingLineAssignmentStrategy();

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
            // 合并租户 Channel 自定义字段，按 name 去重：dev-config 或其它插件已定义的同名字段以既有为准
            // （与下方 ProductVariant 合并去重、ShopPlugin.mergeCustomFields 保持一致，避免复制 app 崩溃报 duplicated custom field）。
            const existingChannelNames = (config.customFields?.Channel || []).map(f => f.name);
            const newChannelFields = (tenantChannelCustomFields.Channel || []).filter(
                f => !existingChannelNames.includes(f.name),
            );
            if (newChannelFields.length > 0) {
                config.customFields = {
                    ...config.customFields,
                    Channel: [
                        ...(config.customFields?.Channel || []),
                        ...newChannelFields,
                    ],
                };
            }
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

        // 注册 ProductVariant customFields（weight/dimensions）—— 去重防止重复注册
        {
            const existingPvFields = (config.customFields?.ProductVariant || []).map(f => f.name);
            const newPvFields = (productVariantCustomFields.ProductVariant || []).filter(
                f => !existingPvFields.includes(f.name),
            );
            if (newPvFields.length > 0) {
                config.customFields = {
                    ...config.customFields,
                    ProductVariant: [
                        ...(config.customFields?.ProductVariant || []),
                        ...newPvFields,
                    ],
                };
            }
        }

        // 注册 ShippingMethod customFields（enabled 启停）—— 去重防止重复注册
        {
            const existingSmFields = (config.customFields?.ShippingMethod || []).map(f => f.name);
            const newSmFields = (customShippingMethodFields.ShippingMethod || []).filter(
                f => !existingSmFields.includes(f.name),
            );
            if (newSmFields.length > 0) {
                config.customFields = {
                    ...config.customFields,
                    ShippingMethod: [
                        ...(config.customFields?.ShippingMethod || []),
                        ...newSmFields,
                    ],
                };
            }
        }

        // 注册自定义权限（PickupPermissions）
        config.authOptions = config.authOptions || {};
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...pickupPermissionDefinitions,
        ];

        // 注册 PickupLocation 全局归属权限（SetGlobalPickupLocation）
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...pickupLocationPermissionDefinitions,
        ];

        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            tenantConfigPermission,
        ];

        // 注册 ShippingTemplate 权限
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...shippingTemplatePermissionDefinitions,
        ];

        // 注册 ShippingProfile 权限
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...shippingProfilePermissionDefinitions,
        ];

        // 注册 PaymentProfile 权限
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...paymentProfilePermissionDefinitions,
        ];

        // 注册 PaymentTemplate 权限
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...paymentTemplatePermissionDefinitions,
        ];

        // 注册租户管理/角色/人员/核销自定义权限
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions || []),
            ...tenantPermissionDefinitions,
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

        // 注入全局共享余额钱包服务到支付 handler（与现有一致：支付处理器经静态 setter 接收服务）
        setWalletService(injector.get(WalletService));

        // 幂等创建默认配送/支付数据（自提点、门店自提配送档案、门店收银支付档案）
        if (this.options.seedDefaultData !== false && this.options.profiles?.enabled !== false) {
            const seedService = injector.get(DefaultDataService);
            await seedService.seed();
        }

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

        // 存量租户默认角色补种子（幂等，仅补缺失；失败不阻塞启动）
        if (this.options.tenant?.enabled) {
            try {
                await injector.get(TenantMemberService).ensureDefaultRolesForAllChannels(RequestContext.empty());
            } catch (e: any) {
                Logger.warn(`默认角色补种子失败（可后台手动触发 importDefaultRoles）: ${e.message}`, loggerCtx);
            }
        }

        // 超管全局豁免渠道校验：把存量渠道补关联到超管角色（幂等；失败不阻塞启动）
        if (this.options.tenant?.enabled) {
            try {
                const tenantSvc = injector.get(TenantMemberService);
                await tenantSvc.ensureSuperAdminRoleCoversAllChannels(RequestContext.empty());
            } catch (e: any) {
                Logger.warn(`超管角色渠道覆盖（存量）失败: ${e.message}`, loggerCtx);
            }
        }

        // 将来新建渠道自动关联到超管角色，保证超管在新租户内同样全局豁免
        {
            const eventBus = injector.get(EventBus);
            eventBus.ofType(ChannelEvent).subscribe(async (event) => {
                if (event.type !== 'created') return;
                try {
                    await injector
                        .get(TenantMemberService)
                        .ensureSuperAdminRoleCoversChannel(event.ctx, (event.entity as any).id);
                } catch (e: any) {
                    Logger.warn(`新渠道关联超管角色失败: ${e.message}`, loggerCtx);
                }
            });
        }

        // 注册 Profile 事件订阅
        if (this.options.profiles?.enabled !== false) {
            const eventBus = injector.get(EventBus);
            const shippingSvc = injector.get(ShippingProfileService);
            const paymentSvc = injector.get(PaymentProfileService);
            const connection = injector.get(TransactionalConnection);

            // 订单结算时快照 Profile 信息
            eventBus.ofType(OrderEvent).subscribe(async (event) => {
                if (event.type !== 'updated') return;
                const order = event.entity;
                if (order.state !== 'PaymentSettled' && order.state !== 'PaymentAuthorized') return;
                const lines = order.lines ?? [];
                if (lines.length === 0) return;

                try {
                    const shippingProfileNames: Record<string, string> = {};
                    const paymentProfileNames: Record<string, string> = {};

                    for (const line of lines) {
                        const variant = line.productVariant;
                        if (!variant) continue;
                        const spId = (variant as any).customFields?.shippingProfileId;
                        const ppId = (variant as any).customFields?.paymentProfileId;
                        if (spId && !shippingProfileNames[spId]) {
                            const profile = await shippingSvc.findOne(event.ctx, spId as any);
                            shippingProfileNames[spId] = profile?.name ?? spId;
                        }
                        if (ppId && !paymentProfileNames[ppId]) {
                            const profile = await paymentSvc.findOne(event.ctx, ppId as any);
                            paymentProfileNames[ppId] = profile?.name ?? ppId;
                        }
                    }

                    const orderRepo = connection.getRepository(event.ctx, 'Order' as any);
                    await orderRepo.update(order.id, {
                        customFields: {
                            shippingProfileSnapshot: JSON.stringify(shippingProfileNames),
                            paymentProfileSnapshot: JSON.stringify(paymentProfileNames),
                        },
                    } as any);
                } catch (e: any) {
                    Logger.error(`Failed to save profile snapshot: ${e.message}`, loggerCtx);
                }
            });

            // 加购时检测混合 Profile 并记录日志
            eventBus.ofType(OrderEvent).subscribe(async (event) => {
                if (event.type !== 'updated') return;
                const order = event.entity;
                if (order.state !== 'AddingItems') return;
                const lines = order.lines ?? [];
                if (lines.length < 2) return;

                const profileIds = new Set<string>();
                for (const line of lines) {
                    const spId = (line.productVariant as any)?.customFields?.shippingProfileId;
                    if (spId) profileIds.add(spId);
                }
                if (profileIds.size > 1) {
                    Logger.info(
                        `Order ${order.code} has mixed shipping profiles: ${[...profileIds].join(', ')}`,
                        loggerCtx,
                    );
                }
            });
        }
    }

    configure(consumer: MiddlewareConsumer): void {}
}
