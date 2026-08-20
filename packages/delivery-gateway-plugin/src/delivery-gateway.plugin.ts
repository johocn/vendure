import { Inject, Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { loggerCtx } from './constants';
import { DeliveryOrder } from './delivery-order.entity';
import { DeliveryGatewayService } from './delivery-gateway.service';
import { MockDeliveryProvider } from './mock-delivery-provider';
import { MockAdminResolver } from './mock-admin.resolver';
import { DadaDeliveryProvider } from './dada-delivery-provider';
import { DadaWebhookController } from './dada-webhook.controller';

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
    controllers: [DadaWebhookController],
    entities: [DeliveryOrder],
    providers: [
        { provide: DELIVERY_GATEWAY_OPTIONS, useFactory: () => DeliveryGatewayPlugin.options },
        DeliveryGatewayService,
        // 字符串 token：供 logistics-plugin 通过注入器 duck-typing 解耦调用（零编译依赖）
        { provide: 'DeliveryOrderShopLinker', useExisting: DeliveryGatewayService },
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
        const dada = (DeliveryGatewayPlugin.options.dada ?? {}) as Record<string, unknown>;
        if (dada?.appKey) {
            this.deliveryGateway.registerProvider(
                new DadaDeliveryProvider({
                    appKey: String(dada.appKey),
                    appSecret: String(dada.appSecret ?? ''),
                    shopNo: String(dada.shopNo ?? ''),
                    sourceId: dada.sourceId ? String(dada.sourceId) : undefined,
                    environment: dada.environment === 'production' ? 'production' : 'sandbox',
                    callbackUrl: String(dada.callbackUrl ?? ''),
                }),
            );
        } else {
            Logger.warn('未配置达达凭据（dada.appKey），跳过 DadaDeliveryProvider 注册', loggerCtx);
        }
        Logger.info('DeliveryGatewayPlugin initialized (MockProvider 已注册)', loggerCtx);
    }
}
