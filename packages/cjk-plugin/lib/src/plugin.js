"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CjkPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CjkPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const core_2 = require("@nestjs/core");
const constants_1 = require("./constants");
const cod_handler_1 = require("./payment/cod-handler");
const aggregate_payment_handler_1 = require("./payment/aggregate-payment-handler");
const fixed_aggregate_collection_handler_1 = require("./payment/fixed-aggregate-collection-handler");
const coupon_stackable_condition_1 = require("./promotion/coupon-stackable-condition");
const promotion_custom_fields_1 = require("./promotion/promotion-custom-fields");
const pickup_calculator_1 = require("./pickup/pickup-calculator");
const pickup_eligibility_checker_1 = require("./pickup/pickup-eligibility-checker");
const pickup_fulfillment_handler_1 = require("./pickup/pickup-fulfillment-handler");
const pickup_location_entity_1 = require("./pickup/pickup-location.entity");
const pickup_location_admin_resolver_1 = require("./pickup/pickup-location-admin.resolver");
const pickup_location_shop_resolver_1 = require("./pickup/pickup-location-shop.resolver");
const pickup_shop_resolver_1 = require("./pickup/pickup-shop.resolver");
const pickup_location_service_1 = require("./pickup/pickup-location.service");
const pickup_permissions_1 = require("./pickup/pickup-permissions");
const pickup_location_permissions_1 = require("./pickup/pickup-location-permissions");
const enterprise_customer_entity_1 = require("./pickup/enterprise-customer/enterprise-customer.entity");
const enterprise_customer_service_1 = require("./pickup/enterprise-customer/enterprise-customer.service");
const enterprise_customer_admin_resolver_1 = require("./pickup/enterprise-customer/enterprise-customer-admin.resolver");
const order_custom_fields_1 = require("./order/order-custom-fields");
const customer_custom_fields_1 = require("./customer/customer-custom-fields");
const tenant_channel_custom_fields_1 = require("./tenant/tenant-channel-custom-fields");
const product_variant_custom_fields_1 = require("./shipping/product-variant-custom-fields");
const shipping_method_custom_fields_1 = require("./shipping/shipping-method-custom-fields");
const asset_custom_fields_1 = require("./asset/asset-custom-fields");
const asset_library_admin_resolver_1 = require("./asset/asset-library-admin.resolver");
const tiered_shipping_calculator_1 = require("./shipping/tiered-shipping-calculator");
const tiered_shipping_eligibility_checker_1 = require("./shipping/tiered-shipping-eligibility-checker");
const shipping_template_entity_1 = require("./shipping/shipping-template.entity");
const shipping_template_service_1 = require("./shipping/shipping-template.service");
const shipping_template_admin_resolver_1 = require("./shipping/shipping-template-admin.resolver");
const shipping_template_permissions_1 = require("./shipping/shipping-template-permissions");
const tenant_setup_service_1 = require("./tenant/tenant-setup.service");
const tenant_member_entity_1 = require("./tenant/tenant-member.entity");
const tenant_permissions_1 = require("./tenant/tenant-permissions");
const tenant_member_service_1 = require("./tenant/tenant-member.service");
const tenant_admin_resolver_1 = require("./tenant/tenant-admin.resolver");
const tenant_member_resolver_1 = require("./tenant/tenant-member.resolver");
const my_access_resolver_1 = require("./tenant/my-access.resolver");
const auth_shop_resolver_1 = require("./auth/auth-shop.resolver");
const auth_admin_resolver_1 = require("./auth/auth-admin.resolver");
const auth_method_guard_1 = require("./auth/auth-method-guard");
const tenant_enabled_guard_1 = require("./auth/tenant-enabled.guard");
const sso_authentication_strategy_1 = require("./auth/sso-authentication-strategy");
const crypto_1 = require("./auth/crypto");
const domain_resolver_service_1 = require("./tenant/domain-resolver.service");
const domain_shop_resolver_1 = require("./tenant/domain-shop.resolver");
const map_provider_registry_1 = require("./map/map-provider-registry");
const map_service_1 = require("./map/map.service");
const map_admin_resolver_1 = require("./map/map-admin.resolver");
const map_shop_resolver_1 = require("./map/map-shop.resolver");
const migrations_1 = require("./migrations");
const auth_config_service_1 = require("./auth/auth-config.service");
const pay_config_service_1 = require("./payment/pay-config.service");
const map_config_service_1 = require("./map/map-config.service");
const sso_provider_service_1 = require("./auth/sso-provider.service");
const invite_code_service_1 = require("./auth/invite-code.service");
const tenant_config_permissions_1 = require("./admin/tenant-config-permissions");
const tenant_config_admin_resolver_1 = require("./admin/tenant-config-admin.resolver");
const shipping_profile_entity_1 = require("./shipping/shipping-profile.entity");
const shipping_profile_method_entity_1 = require("./shipping/shipping-profile-method.entity");
const shipping_profile_service_1 = require("./shipping/shipping-profile.service");
const shipping_profile_admin_resolver_1 = require("./shipping/shipping-profile-admin.resolver");
const shipping_profile_permissions_1 = require("./shipping/shipping-profile-permissions");
const payment_profile_entity_1 = require("./payment/payment-profile.entity");
const payment_profile_method_entity_1 = require("./payment/payment-profile-method.entity");
const payment_profile_service_1 = require("./payment/payment-profile.service");
const payment_profile_admin_resolver_1 = require("./payment/payment-profile-admin.resolver");
const payment_profile_permissions_1 = require("./payment/payment-profile-permissions");
const payment_template_entity_1 = require("./payment/payment-template.entity");
const payment_template_service_1 = require("./payment/payment-template.service");
const payment_template_admin_resolver_1 = require("./payment/payment-template-admin.resolver");
const payment_template_permissions_1 = require("./payment/payment-template-permissions");
const shipping_profile_shop_resolver_1 = require("./shipping/shipping-profile-shop.resolver");
const payment_profile_shop_resolver_1 = require("./payment/payment-profile-shop.resolver");
const order_box_service_1 = require("./order/order-box.service");
const order_box_shop_resolver_1 = require("./order/order-box-shop.resolver");
const order_split_service_1 = require("./order/order-split.service");
const order_split_shop_resolver_1 = require("./order/order-split-shop.resolver");
const box_shipping_line_assignment_strategy_1 = require("./shipping/box-shipping-line-assignment-strategy");
const core_3 = require("@vendure/core");
const default_data_service_1 = require("./seed/default-data.service");
const wallet_entity_1 = require("./wallet/wallet.entity");
const wallet_service_1 = require("./wallet/wallet.service");
const wallet_admin_resolver_1 = require("./wallet/wallet-admin.resolver");
const wallet_shop_resolver_1 = require("./wallet/wallet-shop.resolver");
const balance_wallet_payment_handler_1 = require("./wallet/balance-wallet-payment-handler");
const tenant_catalog_service_1 = require("./tenant/tenant-catalog.service");
const tenant_catalog_admin_resolver_1 = require("./tenant/tenant-catalog-admin.resolver");
const tenant_option_group_service_1 = require("./tenant/tenant-option-group.service");
let CjkPlugin = CjkPlugin_1 = class CjkPlugin {
    constructor(options, moduleRef) {
        this.options = options;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        CjkPlugin_1.options = options;
        return CjkPlugin_1;
    }
    async onApplicationBootstrap() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const injector = new core_1.Injector(this.moduleRef);
        // 注入全局共享余额钱包服务到支付 handler（与现有一致：支付处理器经静态 setter 接收服务）
        (0, balance_wallet_payment_handler_1.setWalletService)(injector.get(wallet_service_1.WalletService));
        // 幂等创建默认配送/支付数据（自提点、门店自提配送档案、门店收银支付档案）
        if (this.options.seedDefaultData !== false && ((_a = this.options.profiles) === null || _a === void 0 ? void 0 : _a.enabled) !== false) {
            const seedService = injector.get(default_data_service_1.DefaultDataService);
            await seedService.seed();
        }
        if (((_b = this.options.i18n) === null || _b === void 0 ? void 0 : _b.enabled) !== false) {
            const i18nService = injector.get(core_1.I18nService);
            const languages = ((_c = this.options.i18n) === null || _c === void 0 ? void 0 : _c.languages) || ['zh_Hans', 'zh_Hant', 'ja', 'ko'];
            const translations = {
                zh_Hans: require('./i18n/zh_CN.json'),
                zh_Hant: require('./i18n/zh_TW.json'),
                ja: require('./i18n/ja.json'),
                ko: require('./i18n/ko.json'),
            };
            for (const lang of languages) {
                if (translations[lang]) {
                    i18nService.addTranslation(lang, translations[lang]);
                    core_1.Logger.info(`Registered i18n translation for ${lang}`, constants_1.loggerCtx);
                }
            }
        }
        if (((_d = this.options.regions) === null || _d === void 0 ? void 0 : _d.enabled) !== false) {
            core_1.Logger.info('CJK regions module enabled - use RegionPopulator in your server bootstrap to populate countries', constants_1.loggerCtx);
        }
        if ((_e = this.options.cod) === null || _e === void 0 ? void 0 : _e.enabled) {
            core_1.Logger.info('Cash on Delivery payment module enabled', constants_1.loggerCtx);
        }
        if ((_f = this.options.storePickup) === null || _f === void 0 ? void 0 : _f.enabled) {
            core_1.Logger.info('Store pickup shipping module enabled', constants_1.loggerCtx);
        }
        if ((_g = this.options.pickupPoint) === null || _g === void 0 ? void 0 : _g.enabled) {
            core_1.Logger.info('Pickup point shipping module enabled', constants_1.loggerCtx);
        }
        if ((_h = this.options.employeePickup) === null || _h === void 0 ? void 0 : _h.enabled) {
            core_1.Logger.info('Employee pickup shipping module enabled', constants_1.loggerCtx);
        }
        if ((_j = this.options.promotionPolicy) === null || _j === void 0 ? void 0 : _j.enabled) {
            core_1.Logger.info('Promotion stacking policy module enabled', constants_1.loggerCtx);
        }
        if ((_k = this.options.tenant) === null || _k === void 0 ? void 0 : _k.enabled) {
            core_1.Logger.info('Tenant (multi-channel) module enabled', constants_1.loggerCtx);
        }
        // 存量租户默认角色补种子（幂等，仅补缺失；失败不阻塞启动）
        if ((_l = this.options.tenant) === null || _l === void 0 ? void 0 : _l.enabled) {
            try {
                await injector.get(tenant_member_service_1.TenantMemberService).ensureDefaultRolesForAllChannels(core_1.RequestContext.empty());
            }
            catch (e) {
                core_1.Logger.warn(`默认角色补种子失败（可后台手动触发 importDefaultRoles）: ${e.message}`, constants_1.loggerCtx);
            }
        }
        // 超管全局豁免渠道校验：把存量渠道补关联到超管角色（幂等；失败不阻塞启动）
        if ((_m = this.options.tenant) === null || _m === void 0 ? void 0 : _m.enabled) {
            try {
                const tenantSvc = injector.get(tenant_member_service_1.TenantMemberService);
                await tenantSvc.ensureSuperAdminRoleCoversAllChannels(core_1.RequestContext.empty());
            }
            catch (e) {
                core_1.Logger.warn(`超管角色渠道覆盖（存量）失败: ${e.message}`, constants_1.loggerCtx);
            }
        }
        // 将来新建渠道自动关联到超管角色，保证超管在新租户内同样全局豁免
        {
            const eventBus = injector.get(core_3.EventBus);
            eventBus.ofType(core_3.ChannelEvent).subscribe(async (event) => {
                if (event.type !== 'created')
                    return;
                try {
                    await injector
                        .get(tenant_member_service_1.TenantMemberService)
                        .ensureSuperAdminRoleCoversChannel(event.ctx, event.entity.id);
                }
                catch (e) {
                    core_1.Logger.warn(`新渠道关联超管角色失败: ${e.message}`, constants_1.loggerCtx);
                }
            });
        }
        // 注册 Profile 事件订阅
        if (((_o = this.options.profiles) === null || _o === void 0 ? void 0 : _o.enabled) !== false) {
            const eventBus = injector.get(core_3.EventBus);
            const shippingSvc = injector.get(shipping_profile_service_1.ShippingProfileService);
            const paymentSvc = injector.get(payment_profile_service_1.PaymentProfileService);
            const connection = injector.get(core_3.TransactionalConnection);
            // 订单结算时快照 Profile 信息
            eventBus.ofType(core_3.OrderEvent).subscribe(async (event) => {
                var _a, _b, _c, _d, _e;
                if (event.type !== 'updated')
                    return;
                const order = event.entity;
                if (order.state !== 'PaymentSettled' && order.state !== 'PaymentAuthorized')
                    return;
                const lines = (_a = order.lines) !== null && _a !== void 0 ? _a : [];
                if (lines.length === 0)
                    return;
                try {
                    const shippingProfileNames = {};
                    const paymentProfileNames = {};
                    for (const line of lines) {
                        const variant = line.productVariant;
                        if (!variant)
                            continue;
                        const spId = (_b = variant.customFields) === null || _b === void 0 ? void 0 : _b.shippingProfileId;
                        const ppId = (_c = variant.customFields) === null || _c === void 0 ? void 0 : _c.paymentProfileId;
                        if (spId && !shippingProfileNames[spId]) {
                            const profile = await shippingSvc.findOne(event.ctx, spId);
                            shippingProfileNames[spId] = (_d = profile === null || profile === void 0 ? void 0 : profile.name) !== null && _d !== void 0 ? _d : spId;
                        }
                        if (ppId && !paymentProfileNames[ppId]) {
                            const profile = await paymentSvc.findOne(event.ctx, ppId);
                            paymentProfileNames[ppId] = (_e = profile === null || profile === void 0 ? void 0 : profile.name) !== null && _e !== void 0 ? _e : ppId;
                        }
                    }
                    const orderRepo = connection.getRepository(event.ctx, 'Order');
                    await orderRepo.update(order.id, {
                        customFields: {
                            shippingProfileSnapshot: JSON.stringify(shippingProfileNames),
                            paymentProfileSnapshot: JSON.stringify(paymentProfileNames),
                        },
                    });
                }
                catch (e) {
                    core_1.Logger.error(`Failed to save profile snapshot: ${e.message}`, constants_1.loggerCtx);
                }
            });
            // 加购时检测混合 Profile 并记录日志
            eventBus.ofType(core_3.OrderEvent).subscribe(async (event) => {
                var _a, _b, _c;
                if (event.type !== 'updated')
                    return;
                const order = event.entity;
                if (order.state !== 'AddingItems')
                    return;
                const lines = (_a = order.lines) !== null && _a !== void 0 ? _a : [];
                if (lines.length < 2)
                    return;
                const profileIds = new Set();
                for (const line of lines) {
                    const spId = (_c = (_b = line.productVariant) === null || _b === void 0 ? void 0 : _b.customFields) === null || _c === void 0 ? void 0 : _c.shippingProfileId;
                    if (spId)
                        profileIds.add(spId);
                }
                if (profileIds.size > 1) {
                    core_1.Logger.info(`Order ${order.code} has mixed shipping profiles: ${[...profileIds].join(', ')}`, constants_1.loggerCtx);
                }
            });
        }
    }
    configure(consumer) { }
};
exports.CjkPlugin = CjkPlugin;
exports.CjkPlugin = CjkPlugin = CjkPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [pickup_location_entity_1.PickupLocation, enterprise_customer_entity_1.EmployeeCustomer, shipping_template_entity_1.ShippingTemplate, shipping_profile_entity_1.ShippingProfile, payment_profile_entity_1.PaymentProfile, shipping_profile_method_entity_1.ShippingProfileMethod, payment_profile_method_entity_1.PaymentProfileMethod, payment_template_entity_1.PaymentTemplate, tenant_member_entity_1.TenantMember, wallet_entity_1.Wallet],
        providers: [
            { provide: constants_1.CJK_PLUGIN_OPTIONS, useFactory: () => CjkPlugin.options },
            tenant_setup_service_1.TenantSetupService,
            pickup_location_service_1.PickupLocationService,
            enterprise_customer_service_1.EmployeeCustomerService,
            domain_resolver_service_1.DomainResolverService,
            map_provider_registry_1.MapProviderRegistry,
            map_service_1.MapService,
            { provide: core_2.APP_GUARD, useClass: auth_method_guard_1.AuthMethodGuard },
            { provide: core_2.APP_GUARD, useClass: tenant_enabled_guard_1.TenantEnabledGuard },
            migrations_1.MapConfigEncryptionMigration,
            migrations_1.PayConfigEncryptionMigration,
            migrations_1.TenantMemberColumnMigration,
            migrations_1.ChannelCustomColumnMigration,
            migrations_1.ShippingContactFlagMigration,
            auth_config_service_1.AuthConfigService,
            pay_config_service_1.PayConfigService,
            map_config_service_1.MapConfigService,
            sso_provider_service_1.SsoProviderService,
            invite_code_service_1.InviteCodeService,
            shipping_template_service_1.ShippingTemplateService,
            shipping_profile_service_1.ShippingProfileService,
            payment_profile_service_1.PaymentProfileService,
            payment_template_service_1.PaymentTemplateService,
            default_data_service_1.DefaultDataService,
            tenant_member_service_1.TenantMemberService,
            order_box_service_1.OrderBoxService,
            order_split_service_1.OrderSplitService,
            wallet_service_1.WalletService,
            tenant_catalog_service_1.TenantCatalogService,
            tenant_option_group_service_1.TenantOptionGroupService,
        ],
        adminApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                return gql `
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

                type ReusableOptionValue {
                    id: ID!
                    name: String!
                }
                type ReusableOptionGroup {
                    id: ID!
                    name: String!
                    options: [ReusableOptionValue!]!
                }
                extend type Query {
                    reusableOptionGroups: [ReusableOptionGroup!]!
                }
                extend type Mutation {
                    reuseOptionGroupForProduct(productId: ID!, optionGroupId: ID!): Boolean!
                }

                type AssetLibraryItem {
                    id: ID!
                    name: String
                    preview: String
                    source: String
                    mimeType: String
                    width: Int
                    height: Int
                    assetTags: [String!]!
                }

                type AssetLibraryResult {
                    items: [AssetLibraryItem!]!
                    totalItems: Int!
                }

                type AssetTagSummary {
                    name: String!
                    count: Int!
                }

                extend type Query {
                    assetLibrary(take: Int, skip: Int, tags: [String]): AssetLibraryResult!
                    assetTags(take: Int): [AssetTagSummary!]!
                }

                extend type Mutation {
                    setAssetTags(assetIds: [String!]!, tags: [String!]): Boolean!
                }

                `;
            },
            resolvers: [pickup_location_admin_resolver_1.PickupLocationAdminResolver, enterprise_customer_admin_resolver_1.EmployeeCustomerAdminResolver, auth_admin_resolver_1.AuthAdminResolver, map_admin_resolver_1.MapAdminResolver, tenant_config_admin_resolver_1.TenantConfigAdminResolver, shipping_template_admin_resolver_1.ShippingTemplateAdminResolver, shipping_profile_admin_resolver_1.ShippingProfileAdminResolver, payment_profile_admin_resolver_1.PaymentProfileAdminResolver, payment_template_admin_resolver_1.PaymentTemplateAdminResolver, tenant_admin_resolver_1.TenantAdminResolver, tenant_member_resolver_1.TenantMemberResolver, my_access_resolver_1.MyAccessResolver, wallet_admin_resolver_1.WalletAdminResolver, tenant_catalog_admin_resolver_1.TenantCatalogAdminResolver, asset_library_admin_resolver_1.AssetLibraryAdminResolver],
        },
        shopApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                return gql `
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
                    loginRequiredPaymentCodes: [String!]!
                    requiresAddress: Boolean!
                    requiresContact: Boolean!
                    type: String!
                    availableShippingMethods: [ShippingMethodBrief!]!
                }

                type ShippingMethodBrief {
                    id: ID!
                    code: String!
                    name: String!
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
            resolvers: [pickup_location_shop_resolver_1.PickupLocationShopResolver, pickup_shop_resolver_1.PickupShopResolver, auth_shop_resolver_1.AuthShopResolver, domain_shop_resolver_1.DomainShopResolver, map_shop_resolver_1.MapShopResolver, shipping_profile_shop_resolver_1.ShippingProfileShopResolver, payment_profile_shop_resolver_1.PaymentProfileShopResolver, order_box_shop_resolver_1.OrderBoxShopResolver, order_split_shop_resolver_1.OrderSplitShopResolver, wallet_shop_resolver_1.WalletShopResolver],
        },
        configuration: config => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            // 注入 authSecret 到 crypto 模块（configuration 在 bootstrap 早期执行，此时 options 已可用）
            (0, crypto_1.setAuthSecret)(CjkPlugin.options.authSecret);
            // 注册 SSO 策略到 shop 端（init 钩子由 Vendure 自动调用）
            config.authOptions = config.authOptions || {};
            config.authOptions.shopAuthenticationStrategy = [
                ...(config.authOptions.shopAuthenticationStrategy || []),
                sso_authentication_strategy_1.ssoAuthenticationStrategy, // 使用单例：resolver 经 export 访问 bindIdentityToUser
            ];
            if ((_a = CjkPlugin.options.cod) === null || _a === void 0 ? void 0 : _a.enabled) {
                config.paymentOptions.paymentMethodHandlers = [
                    ...(config.paymentOptions.paymentMethodHandlers || []),
                    cod_handler_1.codPaymentHandler,
                ];
            }
            // 聚合码支付（线下扫码 + 自确认），默认启用
            if (((_b = CjkPlugin.options.aggregate) === null || _b === void 0 ? void 0 : _b.enabled) !== false) {
                config.paymentOptions.paymentMethodHandlers = [
                    ...(config.paymentOptions.paymentMethodHandlers || []),
                    aggregate_payment_handler_1.aggregatePaymentHandler,
                ];
            }
            // 固定聚合码收款（门店到店收银，自确认），默认启用
            if (((_c = CjkPlugin.options.aggregate) === null || _c === void 0 ? void 0 : _c.enabled) !== false) {
                config.paymentOptions.paymentMethodHandlers = [
                    ...(config.paymentOptions.paymentMethodHandlers || []),
                    fixed_aggregate_collection_handler_1.fixedAggregateCollectionHandler,
                ];
            }
            // 全局共享余额钱包支付（跨租户/跨档案合单），默认启用
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                balance_wallet_payment_handler_1.balanceWalletPaymentHandler,
            ];
            const hasPickup = ((_d = CjkPlugin.options.storePickup) === null || _d === void 0 ? void 0 : _d.enabled)
                || ((_e = CjkPlugin.options.pickupPoint) === null || _e === void 0 ? void 0 : _e.enabled)
                || ((_f = CjkPlugin.options.employeePickup) === null || _f === void 0 ? void 0 : _f.enabled);
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
                if ((_g = CjkPlugin.options.storePickup) === null || _g === void 0 ? void 0 : _g.enabled) {
                    config.shippingOptions.shippingEligibilityCheckers.push(pickup_eligibility_checker_1.storePickupEligibilityChecker);
                    config.shippingOptions.shippingCalculators.push(pickup_calculator_1.storePickupCalculator);
                    config.shippingOptions.fulfillmentHandlers.push(pickup_fulfillment_handler_1.storePickupFulfillmentHandler);
                }
                if ((_h = CjkPlugin.options.pickupPoint) === null || _h === void 0 ? void 0 : _h.enabled) {
                    config.shippingOptions.shippingEligibilityCheckers.push(pickup_eligibility_checker_1.pickupPointEligibilityChecker);
                    config.shippingOptions.shippingCalculators.push(pickup_calculator_1.pickupPointCalculator);
                    config.shippingOptions.fulfillmentHandlers.push(pickup_fulfillment_handler_1.pickupPointFulfillmentHandler);
                }
                if ((_j = CjkPlugin.options.employeePickup) === null || _j === void 0 ? void 0 : _j.enabled) {
                    config.shippingOptions.shippingEligibilityCheckers.push(pickup_eligibility_checker_1.employeePickupEligibilityChecker);
                    config.shippingOptions.shippingCalculators.push(pickup_calculator_1.employeePickupCalculator);
                    config.shippingOptions.fulfillmentHandlers.push(pickup_fulfillment_handler_1.employeePickupFulfillmentHandler);
                }
            }
            // 阶梯重量/件数计费（始终注册，供快递配送方式使用）
            config.shippingOptions = config.shippingOptions || {};
            config.shippingOptions.shippingEligibilityCheckers = [
                ...(config.shippingOptions.shippingEligibilityCheckers || []),
                tiered_shipping_eligibility_checker_1.tieredShippingEligibilityChecker,
            ];
            config.shippingOptions.shippingCalculators = [
                ...(config.shippingOptions.shippingCalculators || []),
                tiered_shipping_calculator_1.tieredWeightShippingCalculator,
                tiered_shipping_calculator_1.tieredQuantityShippingCalculator,
                pickup_calculator_1.localDeliveryCalculator,
            ];
            // 按配送档案分箱：多配送方式时每个 ShippingLine 只挂其箱内 OrderLine，
            // 支撑「单订单内多配送组 / 多 fulfillment」。单箱场景退化为默认全量分配。
            config.shippingOptions.shippingLineAssignmentStrategy = new box_shipping_line_assignment_strategy_1.BoxShippingLineAssignmentStrategy();
            if ((_k = CjkPlugin.options.promotionPolicy) === null || _k === void 0 ? void 0 : _k.enabled) {
                config.promotionOptions = config.promotionOptions || {};
                config.promotionOptions.promotionConditions = [
                    ...(config.promotionOptions.promotionConditions || []),
                    coupon_stackable_condition_1.couponStackableCondition,
                ];
                config.customFields = Object.assign(Object.assign({}, config.customFields), { Promotion: [
                        ...(((_l = config.customFields) === null || _l === void 0 ? void 0 : _l.Promotion) || []),
                        ...promotion_custom_fields_1.promotionCustomFields.Promotion,
                    ] });
            }
            if ((_m = CjkPlugin.options.tenant) === null || _m === void 0 ? void 0 : _m.enabled) {
                // 合并租户 Channel 自定义字段，按 name 去重：dev-config 或其它插件已定义的同名字段以既有为准
                // （与下方 ProductVariant 合并去重、ShopPlugin.mergeCustomFields 保持一致，避免复制 app 崩溃报 duplicated custom field）。
                const existingChannelNames = (((_o = config.customFields) === null || _o === void 0 ? void 0 : _o.Channel) || []).map(f => f.name);
                const newChannelFields = (tenant_channel_custom_fields_1.tenantChannelCustomFields.Channel || []).filter(f => !existingChannelNames.includes(f.name));
                if (newChannelFields.length > 0) {
                    config.customFields = Object.assign(Object.assign({}, config.customFields), { Channel: [
                            ...(((_p = config.customFields) === null || _p === void 0 ? void 0 : _p.Channel) || []),
                            ...newChannelFields,
                        ] });
                }
            }
            // 注册 Order customFields（selectedPickupLocationId、pickupType）
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [
                    ...(((_q = config.customFields) === null || _q === void 0 ? void 0 : _q.Order) || []),
                    ...order_custom_fields_1.orderCustomFields.Order,
                ] });
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Customer: [
                    ...(((_r = config.customFields) === null || _r === void 0 ? void 0 : _r.Customer) || []),
                    ...customer_custom_fields_1.customerCustomFields.Customer,
                ] });
            // 注册 ProductVariant customFields（weight/dimensions）—— 去重防止重复注册
            {
                const existingPvFields = (((_s = config.customFields) === null || _s === void 0 ? void 0 : _s.ProductVariant) || []).map(f => f.name);
                const newPvFields = (product_variant_custom_fields_1.productVariantCustomFields.ProductVariant || []).filter(f => !existingPvFields.includes(f.name));
                if (newPvFields.length > 0) {
                    config.customFields = Object.assign(Object.assign({}, config.customFields), { ProductVariant: [
                            ...(((_t = config.customFields) === null || _t === void 0 ? void 0 : _t.ProductVariant) || []),
                            ...newPvFields,
                        ] });
                }
            }
            // 注册 ShippingMethod customFields（enabled 启停）—— 去重防止重复注册
            {
                const existingSmFields = (((_u = config.customFields) === null || _u === void 0 ? void 0 : _u.ShippingMethod) || []).map(f => f.name);
                const newSmFields = (shipping_method_custom_fields_1.customShippingMethodFields.ShippingMethod || []).filter(f => !existingSmFields.includes(f.name));
                if (newSmFields.length > 0) {
                    config.customFields = Object.assign(Object.assign({}, config.customFields), { ShippingMethod: [
                            ...(((_v = config.customFields) === null || _v === void 0 ? void 0 : _v.ShippingMethod) || []),
                            ...newSmFields,
                        ] });
                }
            }
            // 注册 Asset customFields（uploadedBy 记录上传者，供图库按用户过滤）—— 去重防止重复注册
            {
                const existingAssetFields = (((_w = config.customFields) === null || _w === void 0 ? void 0 : _w.Asset) || []).map(f => f.name);
                const newAssetFields = (asset_custom_fields_1.assetCustomFields.Asset || []).filter(f => !existingAssetFields.includes(f.name));
                if (newAssetFields.length > 0) {
                    config.customFields = Object.assign(Object.assign({}, config.customFields), { Asset: [
                            ...(((_x = config.customFields) === null || _x === void 0 ? void 0 : _x.Asset) || []),
                            ...newAssetFields,
                        ] });
                }
            }
            // 注册自定义权限（PickupPermissions）
            config.authOptions = config.authOptions || {};
            config.authOptions.customPermissions = [
                ...(config.authOptions.customPermissions || []),
                ...pickup_permissions_1.pickupPermissionDefinitions,
            ];
            // 注册 PickupLocation 全局归属权限（SetGlobalPickupLocation）
            config.authOptions.customPermissions = [
                ...(config.authOptions.customPermissions || []),
                ...pickup_location_permissions_1.pickupLocationPermissionDefinitions,
            ];
            config.authOptions.customPermissions = [
                ...(config.authOptions.customPermissions || []),
                tenant_config_permissions_1.tenantConfigPermission,
            ];
            // 注册 ShippingTemplate 权限
            config.authOptions.customPermissions = [
                ...(config.authOptions.customPermissions || []),
                ...shipping_template_permissions_1.shippingTemplatePermissionDefinitions,
            ];
            // 注册 ShippingProfile 权限
            config.authOptions.customPermissions = [
                ...(config.authOptions.customPermissions || []),
                ...shipping_profile_permissions_1.shippingProfilePermissionDefinitions,
            ];
            // 注册 PaymentProfile 权限
            config.authOptions.customPermissions = [
                ...(config.authOptions.customPermissions || []),
                ...payment_profile_permissions_1.paymentProfilePermissionDefinitions,
            ];
            // 注册 PaymentTemplate 权限
            config.authOptions.customPermissions = [
                ...(config.authOptions.customPermissions || []),
                ...payment_template_permissions_1.paymentTemplatePermissionDefinitions,
            ];
            // 注册租户管理/角色/人员/核销自定义权限
            config.authOptions.customPermissions = [
                ...(config.authOptions.customPermissions || []),
                ...tenant_permissions_1.tenantPermissionDefinitions,
            ];
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.CJK_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_2.ModuleRef])
], CjkPlugin);
//# sourceMappingURL=plugin.js.map