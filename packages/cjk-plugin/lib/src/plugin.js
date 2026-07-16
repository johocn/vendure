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
const enterprise_customer_entity_1 = require("./pickup/enterprise-customer/enterprise-customer.entity");
const enterprise_customer_service_1 = require("./pickup/enterprise-customer/enterprise-customer.service");
const enterprise_customer_admin_resolver_1 = require("./pickup/enterprise-customer/enterprise-customer-admin.resolver");
const order_custom_fields_1 = require("./order/order-custom-fields");
const tenant_channel_custom_fields_1 = require("./tenant/tenant-channel-custom-fields");
const tenant_setup_service_1 = require("./tenant/tenant-setup.service");
const auth_shop_resolver_1 = require("./auth/auth-shop.resolver");
const auth_admin_resolver_1 = require("./auth/auth-admin.resolver");
const auth_method_guard_1 = require("./auth/auth-method-guard");
const sso_authentication_strategy_1 = require("./auth/sso-authentication-strategy");
const crypto_1 = require("./auth/crypto");
const domain_resolver_service_1 = require("./tenant/domain-resolver.service");
const domain_shop_resolver_1 = require("./tenant/domain-shop.resolver");
const map_provider_registry_1 = require("./map/map-provider-registry");
const map_service_1 = require("./map/map.service");
const map_admin_resolver_1 = require("./map/map-admin.resolver");
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const injector = new core_1.Injector(this.moduleRef);
        if (((_a = this.options.i18n) === null || _a === void 0 ? void 0 : _a.enabled) !== false) {
            const i18nService = injector.get(core_1.I18nService);
            const languages = ((_b = this.options.i18n) === null || _b === void 0 ? void 0 : _b.languages) || ['zh_Hans', 'zh_Hant', 'ja', 'ko'];
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
        if (((_c = this.options.regions) === null || _c === void 0 ? void 0 : _c.enabled) !== false) {
            core_1.Logger.info('CJK regions module enabled - use RegionPopulator in your server bootstrap to populate countries', constants_1.loggerCtx);
        }
        if ((_d = this.options.cod) === null || _d === void 0 ? void 0 : _d.enabled) {
            core_1.Logger.info('Cash on Delivery payment module enabled', constants_1.loggerCtx);
        }
        if ((_e = this.options.storePickup) === null || _e === void 0 ? void 0 : _e.enabled) {
            core_1.Logger.info('Store pickup shipping module enabled', constants_1.loggerCtx);
        }
        if ((_f = this.options.pickupPoint) === null || _f === void 0 ? void 0 : _f.enabled) {
            core_1.Logger.info('Pickup point shipping module enabled', constants_1.loggerCtx);
        }
        if ((_g = this.options.employeePickup) === null || _g === void 0 ? void 0 : _g.enabled) {
            core_1.Logger.info('Employee pickup shipping module enabled', constants_1.loggerCtx);
        }
        if ((_h = this.options.promotionPolicy) === null || _h === void 0 ? void 0 : _h.enabled) {
            core_1.Logger.info('Promotion stacking policy module enabled', constants_1.loggerCtx);
        }
        if ((_j = this.options.tenant) === null || _j === void 0 ? void 0 : _j.enabled) {
            core_1.Logger.info('Tenant (multi-channel) module enabled', constants_1.loggerCtx);
        }
    }
    configure(consumer) { }
};
exports.CjkPlugin = CjkPlugin;
exports.CjkPlugin = CjkPlugin = CjkPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [pickup_location_entity_1.PickupLocation, enterprise_customer_entity_1.EmployeeCustomer],
        providers: [
            { provide: constants_1.CJK_PLUGIN_OPTIONS, useFactory: () => CjkPlugin.options },
            tenant_setup_service_1.TenantSetupService,
            pickup_location_service_1.PickupLocationService,
            enterprise_customer_service_1.EmployeeCustomerService,
            domain_resolver_service_1.DomainResolverService,
            map_provider_registry_1.MapProviderRegistry,
            map_service_1.MapService,
            { provide: core_2.APP_GUARD, useClass: auth_method_guard_1.AuthMethodGuard },
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
                    channelMapConfig: ChannelMapConfig!
                }
            `;
            },
            resolvers: [pickup_location_admin_resolver_1.PickupLocationAdminResolver, enterprise_customer_admin_resolver_1.EmployeeCustomerAdminResolver, auth_admin_resolver_1.AuthAdminResolver, map_admin_resolver_1.MapAdminResolver],
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
            resolvers: [pickup_location_shop_resolver_1.PickupLocationShopResolver, pickup_shop_resolver_1.PickupShopResolver, auth_shop_resolver_1.AuthShopResolver, domain_shop_resolver_1.DomainShopResolver],
        },
        configuration: config => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            // 注入 authSecret 到 crypto 模块（configuration 在 bootstrap 早期执行，此时 options 已可用）
            (0, crypto_1.setAuthSecret)(CjkPlugin.options.authSecret);
            // 注册 SSO 策略到 shop 端（init 钩子由 Vendure 自动调用）
            config.authOptions = config.authOptions || {};
            config.authOptions.shopAuthenticationStrategy = [
                ...(config.authOptions.shopAuthenticationStrategy || []),
                new sso_authentication_strategy_1.SsoAuthenticationStrategy(),
            ];
            if ((_a = CjkPlugin.options.cod) === null || _a === void 0 ? void 0 : _a.enabled) {
                config.paymentOptions.paymentMethodHandlers = [
                    ...(config.paymentOptions.paymentMethodHandlers || []),
                    cod_handler_1.codPaymentHandler,
                ];
            }
            const hasPickup = ((_b = CjkPlugin.options.storePickup) === null || _b === void 0 ? void 0 : _b.enabled)
                || ((_c = CjkPlugin.options.pickupPoint) === null || _c === void 0 ? void 0 : _c.enabled)
                || ((_d = CjkPlugin.options.employeePickup) === null || _d === void 0 ? void 0 : _d.enabled);
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
                if ((_e = CjkPlugin.options.storePickup) === null || _e === void 0 ? void 0 : _e.enabled) {
                    config.shippingOptions.shippingEligibilityCheckers.push(pickup_eligibility_checker_1.storePickupEligibilityChecker);
                    config.shippingOptions.shippingCalculators.push(pickup_calculator_1.storePickupCalculator);
                    config.shippingOptions.fulfillmentHandlers.push(pickup_fulfillment_handler_1.storePickupFulfillmentHandler);
                }
                if ((_f = CjkPlugin.options.pickupPoint) === null || _f === void 0 ? void 0 : _f.enabled) {
                    config.shippingOptions.shippingEligibilityCheckers.push(pickup_eligibility_checker_1.pickupPointEligibilityChecker);
                    config.shippingOptions.shippingCalculators.push(pickup_calculator_1.pickupPointCalculator);
                    config.shippingOptions.fulfillmentHandlers.push(pickup_fulfillment_handler_1.pickupPointFulfillmentHandler);
                }
                if ((_g = CjkPlugin.options.employeePickup) === null || _g === void 0 ? void 0 : _g.enabled) {
                    config.shippingOptions.shippingEligibilityCheckers.push(pickup_eligibility_checker_1.employeePickupEligibilityChecker);
                    config.shippingOptions.shippingCalculators.push(pickup_calculator_1.employeePickupCalculator);
                    config.shippingOptions.fulfillmentHandlers.push(pickup_fulfillment_handler_1.employeePickupFulfillmentHandler);
                }
            }
            if ((_h = CjkPlugin.options.promotionPolicy) === null || _h === void 0 ? void 0 : _h.enabled) {
                config.promotionOptions = config.promotionOptions || {};
                config.promotionOptions.promotionConditions = [
                    ...(config.promotionOptions.promotionConditions || []),
                    coupon_stackable_condition_1.couponStackableCondition,
                ];
                config.customFields = Object.assign(Object.assign({}, config.customFields), { Promotion: [
                        ...(((_j = config.customFields) === null || _j === void 0 ? void 0 : _j.Promotion) || []),
                        ...promotion_custom_fields_1.promotionCustomFields.Promotion,
                    ] });
            }
            if ((_k = CjkPlugin.options.tenant) === null || _k === void 0 ? void 0 : _k.enabled) {
                config.customFields = Object.assign(Object.assign({}, config.customFields), { Channel: [
                        ...(((_l = config.customFields) === null || _l === void 0 ? void 0 : _l.Channel) || []),
                        ...tenant_channel_custom_fields_1.tenantChannelCustomFields.Channel,
                    ] });
            }
            // 注册 Order customFields（selectedPickupLocationId、pickupType）
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [
                    ...(((_m = config.customFields) === null || _m === void 0 ? void 0 : _m.Order) || []),
                    ...order_custom_fields_1.orderCustomFields.Order,
                ] });
            // 注册自定义权限（PickupPermissions）
            config.authOptions = config.authOptions || {};
            config.authOptions.customPermissions = [
                ...(config.authOptions.customPermissions || []),
                ...pickup_permissions_1.pickupPermissionDefinitions,
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