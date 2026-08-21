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
var AddressPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const delivery_address_entity_1 = require("./delivery-address.entity");
const delivery_admin_resolver_1 = require("./delivery-admin.resolver");
const delivery_range_entity_1 = require("./delivery-range.entity");
const delivery_service_1 = require("./delivery.service");
const delivery_shop_resolver_1 = require("./delivery-shop.resolver");
const order_custom_fields_1 = require("./order-custom-fields");
const range_shipping_calculator_1 = require("./range-shipping-calculator");
const range_shipping_eligibility_checker_1 = require("./range-shipping-eligibility-checker");
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
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
const shopSchema = () => gql `
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
let AddressPlugin = AddressPlugin_1 = class AddressPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        AddressPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return AddressPlugin_1;
    }
};
exports.AddressPlugin = AddressPlugin;
AddressPlugin.options = {};
exports.AddressPlugin = AddressPlugin = AddressPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [delivery_address_entity_1.DeliveryAddress, delivery_range_entity_1.DeliveryRange],
        providers: [
            { provide: constants_1.ADDRESS_PLUGIN_OPTIONS, useFactory: () => AddressPlugin.options },
            delivery_service_1.DeliveryService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [delivery_admin_resolver_1.DeliveryAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [delivery_shop_resolver_1.DeliveryShopResolver],
        },
        configuration: (config) => {
            var _a, _b;
            // 订单侧收件区划码/经纬度（结算校验 + 运费联动取值源）；按字段名幂等去重
            const orderNames = new Set(((_a = config.customFields.Order) !== null && _a !== void 0 ? _a : []).map(f => f.name));
            config.customFields.Order = [
                ...((_b = config.customFields.Order) !== null && _b !== void 0 ? _b : []),
                ...order_custom_fields_1.addressOrderCustomFields.filter(f => f != null && !orderNames.has(f.name)),
            ];
            // 结算拦截 + 按店运费：注册 checker/calculator（幂等去重）
            const checkerCodes = new Set(config.shippingOptions.shippingEligibilityCheckers.map(c => c.code));
            if (!checkerCodes.has(range_shipping_eligibility_checker_1.rangeShippingEligibilityChecker.code)) {
                config.shippingOptions.shippingEligibilityCheckers.push(range_shipping_eligibility_checker_1.rangeShippingEligibilityChecker);
            }
            const calcCodes = new Set(config.shippingOptions.shippingCalculators.map(c => c.code));
            if (!calcCodes.has(range_shipping_calculator_1.rangeShippingCalculator.code)) {
                config.shippingOptions.shippingCalculators.push(range_shipping_calculator_1.rangeShippingCalculator);
            }
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.ADDRESS_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], AddressPlugin);
//# sourceMappingURL=plugin.js.map