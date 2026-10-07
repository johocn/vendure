import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, LanguageCode, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { AFTER_SALES_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { AfterSalesPluginOptions } from './types';
import { AfterSalesRequest } from './after-sales-request.entity';
import { AfterSalesStateHistory } from './after-sales-state-history.entity';
import { AfterSalesMessage } from './after-sales-message.entity';
import { AfterSalesService } from './after-sales.service';
import { AfterSalesShopResolver } from './after-sales-shop.resolver';
import { AfterSalesAdminResolver } from './after-sales-admin.resolver';
import { afterSalesOrderCustomFields } from './order-custom-fields';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [AfterSalesRequest, AfterSalesStateHistory, AfterSalesMessage],
    providers: [
        { provide: AFTER_SALES_PLUGIN_OPTIONS, useFactory: () => AfterSalesPlugin.options },
        AfterSalesService,
    ],
    exports: [AfterSalesService],
    shopApiExtensions: {
        schema: () => gql`
            enum AfterSalesType { return_refund refund_only exchange }
            enum AfterSalesState { Pending Approved Rejected Returning Received Refunded RefundFailed Closed }

            type AfterSalesStateHistoryEntry {
                fromState: AfterSalesState
                toState: AfterSalesState!
                operatorUserId: ID
                createdAt: DateTime!
            }

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
                history: [AfterSalesStateHistoryEntry!]!
                messageCount: Int!
            }

            type AfterSalesRequestList implements PaginatedList {
                items: [AfterSalesRequest!]!
                totalItems: Int!
            }

            type AfterSalesMessage implements Node {
                id: ID!
                requestId: ID!
                senderType: String!
                senderUserId: ID
                senderName: String!
                content: String!
                images: [String!]
                createdAt: DateTime!
            }

            type AfterSalesMessageList implements PaginatedList {
                items: [AfterSalesMessage!]!
                totalItems: Int!
            }

            input AfterSalesMessageListOptions {

                skip: Int

                take: Int

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
                afterSalesReturnAddress: String!
                afterSalesMessages(id: ID!, options: AfterSalesMessageListOptions): AfterSalesMessageList!
            }

            extend type Mutation {
                createAfterSalesRequest(input: CreateAfterSalesRequestInput!): AfterSalesRequest!
                cancelAfterSalesRequest(id: ID!): AfterSalesRequest!
                updateReturnTracking(id: ID!, trackingNo: String!, carrier: String!): AfterSalesRequest!
                """顾客端上传售后凭证图：入参为 base64 data URL 数组，返回图片 URL 数组（不创建售后单）"""
                uploadAfterSalesEvidence(images: [String!]!): [String!]!
                """售后单内追加协商留言（Closed 后禁言；图片 ≤3 张、正文 ≤1000 字）"""
                addAfterSalesMessage(id: ID!, content: String!, images: [String!]): AfterSalesMessage!
            }
        `,
        resolvers: [AfterSalesShopResolver],
    },
    adminApiExtensions: {
        schema: () => gql`
            type AfterSalesStateHistoryEntry {
                fromState: String
                toState: String!
                operatorUserId: ID
                createdAt: DateTime!
            }

            type AfterSalesBatchResult {
                id: ID!
                success: Boolean!
                state: String
                message: String
            }

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
                order: Order
                orderLine: OrderLine
                customer: Customer
                history: [AfterSalesStateHistoryEntry!]!
                messageCount: Int!
            }

            type AfterSalesRequestAdminList implements PaginatedList {
                items: [AfterSalesRequestAdmin!]!
                totalItems: Int!
            }

            type AfterSalesMessageAdmin implements Node {
                id: ID!
                requestId: ID!
                senderType: String!
                senderUserId: ID
                senderName: String!
                content: String!
                images: [String!]
                createdAt: DateTime!
            }

            type AfterSalesMessageAdminList implements PaginatedList {
                items: [AfterSalesMessageAdmin!]!
                totalItems: Int!
            }

            input AfterSalesMessageAdminListOptions {

                skip: Int

                take: Int

            }

            input AfterSalesRequestAdminListOptions

            extend type Query {
                afterSalesRequests(options: AfterSalesRequestAdminListOptions): AfterSalesRequestAdminList!
                afterSalesRequestAdmin(id: ID!): AfterSalesRequestAdmin
                afterSalesReturnAddress: String!
                afterSalesMessages(id: ID!, options: AfterSalesMessageAdminListOptions): AfterSalesMessageAdminList!
            }

            extend type Mutation {
                approveAfterSalesRequest(id: ID!): AfterSalesRequestAdmin!
                rejectAfterSalesRequest(id: ID!, reason: String!): AfterSalesRequestAdmin!
                confirmReturnReceived(id: ID!, receivedQuantity: Int): AfterSalesRequestAdmin!
                processAfterSalesRefund(id: ID!): AfterSalesRequestAdmin!
                retryAfterSalesRefund(id: ID!): AfterSalesRequestAdmin!
                batchApproveAfterSalesRequests(ids: [ID!]!): [AfterSalesBatchResult!]!
                batchRejectAfterSalesRequests(ids: [ID!]!, reason: String!): [AfterSalesBatchResult!]!
                updateAfterSalesReturnAddress(address: String!): Boolean!
                """商家回复售后协商留言（Closed 后禁言；图片 ≤3 张、正文 ≤1000 字）"""
                replyAfterSalesMessage(id: ID!, content: String!, images: [String!]): AfterSalesMessageAdmin!
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
            Channel: [
                ...(config.customFields?.Channel ?? []),
                {
                    name: 'afterSalesReturnAddress',
                    type: 'string',
                    nullable: true,
                    label: [{ languageCode: LanguageCode.zh_Hans, value: '售后寄回地址' }],
                },
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
