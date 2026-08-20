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
var DeliveryGatewayPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryGatewayPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const delivery_order_entity_1 = require("./delivery-order.entity");
const delivery_gateway_service_1 = require("./delivery-gateway.service");
const mock_delivery_provider_1 = require("./mock-delivery-provider");
const mock_admin_resolver_1 = require("./mock-admin.resolver");
const { gql } = require('graphql-tag');
const DELIVERY_GATEWAY_OPTIONS = 'DELIVERY_GATEWAY_OPTIONS';
const adminSchema = () => gql `
    type DeliveryOrderAdmin {
        id: ID!
        code: String!
        orderId: ID!
        packageId: String
        fulfillmentId: ID
        providerCode: String!
        thirdPartyNo: String
        status: String!
        fee: Int
        etaMinutes: Int
        courierName: String
        courierPhone: String
        acceptedAt: DateTime
        pickupAt: DateTime
        deliveredAt: DateTime
        cancelledAt: DateTime
        reason: String
    }
    extend type Query {
        deliveryOrders(orderId: ID!): [DeliveryOrderAdmin!]!
    }
    extend type Mutation {
        mockDeliveryEvent(deliveryOrderNo: String!, status: String!, courierName: String, courierPhone: String, reason: String): Boolean!
        createDelivery(input: DeliveryCreateInput!): DeliveryOrderAdmin!
    }
    input DeliveryCreateInput {
        orderId: ID!
        packageId: String!
        providerCode: String!
        pickup: DeliveryGeoInput!
        dropoff: DeliveryGeoInput!
        items: [DeliveryItemInput!]!
        remark: String
    }
    input DeliveryGeoInput {
        name: String!
        address: String
        lat: Float!
        lng: Float!
        phone: String
    }
    input DeliveryItemInput {
        name: String!
        quantity: Int!
    }
`;
let DeliveryGatewayPlugin = DeliveryGatewayPlugin_1 = class DeliveryGatewayPlugin {
    constructor(optionsToken, deliveryGateway, moduleRef) {
        this.optionsToken = optionsToken;
        this.deliveryGateway = deliveryGateway;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        DeliveryGatewayPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return DeliveryGatewayPlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.deliveryGateway.init(this.injector);
        this.deliveryGateway.registerProvider(new mock_delivery_provider_1.MockDeliveryProvider());
        core_2.Logger.info('DeliveryGatewayPlugin initialized (MockProvider 已注册)', constants_1.loggerCtx);
    }
};
exports.DeliveryGatewayPlugin = DeliveryGatewayPlugin;
DeliveryGatewayPlugin.options = {};
exports.DeliveryGatewayPlugin = DeliveryGatewayPlugin = DeliveryGatewayPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [delivery_order_entity_1.DeliveryOrder],
        providers: [
            { provide: DELIVERY_GATEWAY_OPTIONS, useFactory: () => DeliveryGatewayPlugin.options },
            delivery_gateway_service_1.DeliveryGatewayService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [mock_admin_resolver_1.MockAdminResolver],
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(DELIVERY_GATEWAY_OPTIONS)),
    __metadata("design:paramtypes", [Object, delivery_gateway_service_1.DeliveryGatewayService,
        core_1.ModuleRef])
], DeliveryGatewayPlugin);
//# sourceMappingURL=delivery-gateway.plugin.js.map