import { Inject, Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { loggerCtx } from './constants';
import { DeliveryOrder } from './delivery-order.entity';
import { DeliveryGatewayService } from './delivery-gateway.service';
import { MockDeliveryProvider } from './mock-delivery-provider';
import { MockAdminResolver } from './mock-admin.resolver';

const { gql } = require('graphql-tag');

const DELIVERY_GATEWAY_OPTIONS = 'DELIVERY_GATEWAY_OPTIONS';

const adminSchema = () => gql`
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

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [DeliveryOrder],
    providers: [
        { provide: DELIVERY_GATEWAY_OPTIONS, useFactory: () => DeliveryGatewayPlugin.options },
        DeliveryGatewayService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [MockAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class DeliveryGatewayPlugin {
    private static options: Record<string, unknown> = {};
    private injector!: Injector;

    constructor(
        @Inject(DELIVERY_GATEWAY_OPTIONS) private optionsToken: Record<string, unknown>,
        private deliveryGateway: DeliveryGatewayService,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: Record<string, unknown>): Type<DeliveryGatewayPlugin> {
        DeliveryGatewayPlugin.options = options ?? {};
        return DeliveryGatewayPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.deliveryGateway.init(this.injector);
        this.deliveryGateway.registerProvider(new MockDeliveryProvider());
        Logger.info('DeliveryGatewayPlugin initialized (MockProvider 已注册)', loggerCtx);
    }
}
