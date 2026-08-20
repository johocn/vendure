import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { AFTER_SALES_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { AfterSalesPluginOptions } from './types';
import { AfterSalesRequest } from './after-sales-request.entity';
import { AfterSalesService } from './after-sales.service';
import { AfterSalesShopResolver } from './after-sales-shop.resolver';
import { AfterSalesAdminResolver } from './after-sales-admin.resolver';
import { afterSalesOrderCustomFields } from './order-custom-fields';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [AfterSalesRequest],
    providers: [
        { provide: AFTER_SALES_PLUGIN_OPTIONS, useFactory: () => AfterSalesPlugin.options },
        AfterSalesService,
    ],
    exports: [AfterSalesService],
    shopApiExtensions: {
        schema: () => gql`
            enum AfterSalesType { return_refund refund_only exchange }
            enum AfterSalesState { Pending Approved Rejected Returning Received Refunded RefundFailed Closed }

            type AfterSalesRequest implements Node {
                id: ID!
                orderId: ID!
                orderLineId: ID
                type: AfterSalesType!
                state: AfterSalesState!
                reason: String!
                description: String
                evidenceImages: [String!]
                refundAmount: Int!
                returnTrackingNo: String
                returnCarrier: String
                rejectReason: String
                receivedQuantity: Int
                refundTransactionId: String
                actualRefundAmount: Int
                refundedAt: DateTime
                refundError: String
                createdAt: DateTime!
                updatedAt: DateTime!
                order: Order!
                orderLine: OrderLine
            }

            type AfterSalesRequestList implements PaginatedList {
                items: [AfterSalesRequest!]!
                totalItems: Int!
            }

            input CreateAfterSalesRequestInput {
                orderId: ID!
                orderLineId: ID
                type: AfterSalesType
                reason: String!
                description: String
                evidenceImages: [String!]
                refundAmount: Int!
                receivedQuantity: Int
            }

            input AfterSalesRequestListOptions


            extend type Query {
                myAfterSalesRequests(options: AfterSalesRequestListOptions): AfterSalesRequestList!
                afterSalesRequest(id: ID!): AfterSalesRequest
            }

            extend type Mutation {
                createAfterSalesRequest(input: CreateAfterSalesRequestInput!): AfterSalesRequest!
                cancelAfterSalesRequest(id: ID!): AfterSalesRequest!
                updateReturnTracking(id: ID!, trackingNo: String!, carrier: String!): AfterSalesRequest!
            }
        `,
        resolvers: [AfterSalesShopResolver],
    },
    adminApiExtensions: {
        schema: () => gql`
            type AfterSalesRequestAdmin implements Node {
                id: ID!
                orderId: ID!
                orderLineId: ID
                type: String!
                state: String!
                reason: String!
                description: String
                evidenceImages: [String!]
                refundAmount: Int!
                returnTrackingNo: String
                returnCarrier: String
                rejectReason: String
                receivedQuantity: Int
                restockJson: String
                refundTransactionId: String
                actualRefundAmount: Int
                refundedAt: DateTime
                refundError: String
                customerId: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type AfterSalesRequestAdminList implements PaginatedList {
                items: [AfterSalesRequestAdmin!]!
                totalItems: Int!
            }

            input AfterSalesRequestAdminListOptions

            extend type Query {
                afterSalesRequests(options: AfterSalesRequestAdminListOptions): AfterSalesRequestAdminList!
            }

            extend type Mutation {
                approveAfterSalesRequest(id: ID!): AfterSalesRequestAdmin!
                rejectAfterSalesRequest(id: ID!, reason: String!): AfterSalesRequestAdmin!
                confirmReturnReceived(id: ID!, receivedQuantity: Int): AfterSalesRequestAdmin!
                processAfterSalesRefund(id: ID!): AfterSalesRequestAdmin!
                retryAfterSalesRefund(id: ID!): AfterSalesRequestAdmin!
            }
        `,
        resolvers: [AfterSalesAdminResolver],
    },
    configuration: (config) => {
        config.customFields = {
            ...config.customFields,
            Order: [
                ...(config.customFields?.Order ?? []),
                ...afterSalesOrderCustomFields.Order!,
            ],
        };
        return config;
    },
    compatibility: '^3.0.0',
})
export class AfterSalesPlugin implements OnApplicationBootstrap {
    private static options: AfterSalesPluginOptions = {};
    private injector: Injector;

    constructor(
        @Inject(AFTER_SALES_PLUGIN_OPTIONS) private options: AfterSalesPluginOptions,
        private afterSalesService: AfterSalesService,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: AfterSalesPluginOptions): Type<AfterSalesPlugin> {
        AfterSalesPlugin.options = options ?? {};
        return AfterSalesPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.afterSalesService.init(this.injector);
        Logger.info('AfterSalesPlugin initialized', loggerCtx);
    }
}
