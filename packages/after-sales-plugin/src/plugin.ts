import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus, Injector, LanguageCode, Logger, PluginCommonModule, ScheduledTask, VendurePlugin } from '@vendure/core';

import { AFTER_SALES_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { AfterSalesPluginOptions } from './types';
import { AfterSalesRequest } from './after-sales-request.entity';
import { AfterSalesStateHistory } from './after-sales-state-history.entity';
import { AfterSalesMessage } from './after-sales-message.entity';
import { AfterSalesService } from './after-sales.service';
import { AfterSalesShopResolver } from './after-sales-shop.resolver';
import { AfterSalesAdminResolver } from './after-sales-admin.resolver';
import { afterSalesOrderCustomFields } from './order-custom-fields';
import { AfterSalesStateTransitionEvent } from './after-sales.events';
import { resolveAfterSalesThresholds } from './after-sales-config';
import { AfterSalesTimeoutJob } from './after-sales-timeout.job';
import { AfterSalesTimeoutTask, AfterSalesTimeoutType } from './after-sales-timeout.entity';

const { gql } = require('graphql-tag');

const COMPENSATION_TASK_ID = 'after-sales-timeout-compensation';

const compensationTask = new ScheduledTask({
    id: COMPENSATION_TASK_ID,
    description: 'Scan overdue AfterSalesTimeoutTask records and re-enqueue them',
    schedule: cron => cron.every(5).minutes(),
    async execute({ injector }) {
        const job = injector.get(AfterSalesTimeoutJob);
        await job.runCompensation();
    },
});

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [AfterSalesRequest, AfterSalesStateHistory, AfterSalesMessage, AfterSalesTimeoutTask],
    providers: [
        { provide: AFTER_SALES_PLUGIN_OPTIONS, useFactory: () => AfterSalesPlugin.options },
        AfterSalesService,
        AfterSalesTimeoutJob,
    ],
    exports: [AfterSalesService],
    shopApiExtensions: {
        schema: () => gql`
            enum AfterSalesType { return_refund refund_only exchange }
            enum AfterSalesState { Pending Approved Rejected Returning Received ExchangeShipped Refunded RefundFailed Closed }

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
                exchangeTrackingNo: String
                exchangeCarrier: String
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
                """顾客确认收到换货商品：ExchangeShipped → Closed"""
                exchangeReceiveAfterSalesRequest(id: ID!): AfterSalesRequest!
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
                exchangeTrackingNo: String
                exchangeCarrier: String
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
                """换货发货：Received → ExchangeShipped（仅 exchange 类型）"""
                exchangeShipAfterSalesRequest(id: ID!, trackingNo: String!, carrier: String!): AfterSalesRequestAdmin!
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
                {
                    name: 'afterSalesTimeoutHours',
                    type: 'int',
                    defaultValue: 48,
                    label: [{ languageCode: LanguageCode.zh_Hans, value: '售后待处理超时提醒（小时）' }],
                },
                {
                    name: 'afterSalesAutoApproveHours',
                    type: 'int',
                    defaultValue: 0,
                    label: [{ languageCode: LanguageCode.zh_Hans, value: '售后超时自动同意（小时，0=关闭）' }],
                },
                {
                    name: 'afterSalesRefundAutoRetry',
                    type: 'int',
                    defaultValue: 1,
                    label: [{ languageCode: LanguageCode.zh_Hans, value: '退款失败自动重试次数（0=关闭）' }],
                },
            ],
        };
        const exists = config.schedulerOptions.tasks.some(t => t.id === COMPENSATION_TASK_ID);
        if (!exists) {
            config.schedulerOptions.tasks.push(compensationTask);
        }
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
        private afterSalesTimeoutJob: AfterSalesTimeoutJob,
        private eventBus: EventBus,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: AfterSalesPluginOptions): Type<AfterSalesPlugin> {
        AfterSalesPlugin.options = options ?? {};
        return AfterSalesPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.afterSalesService.init(this.injector);
        await this.afterSalesTimeoutJob.init();

        // 状态流转 → 登记超时任务（Pending 提醒 / Pending 自动同意 / RefundFailed 重试）
        this.eventBus.ofType(AfterSalesStateTransitionEvent).subscribe((e) => {
            void this.onAfterSalesStateTransition(e);
        });

        Logger.info('AfterSalesPlugin initialized', loggerCtx);
    }

    private async onAfterSalesStateTransition(e: AfterSalesStateTransitionEvent): Promise<void> {
        try {
            const thresholds = await resolveAfterSalesThresholds(
                this.injector,
                e.ctx,
                e.ctx.channelId,
                AfterSalesPlugin.options,
            );
            if (e.toState === 'Pending' && e.fromState === null) {
                await this.afterSalesTimeoutJob.scheduleTimeout(
                    AfterSalesTimeoutType.PENDING_REMIND,
                    e.requestId,
                    Number(e.ctx.channelId),
                    thresholds.timeoutHours * 60 * 60 * 1000,
                    'Pending',
                );
                if (thresholds.autoApproveHours > 0) {
                    await this.afterSalesTimeoutJob.scheduleTimeout(
                        AfterSalesTimeoutType.PENDING_AUTO_APPROVE,
                        e.requestId,
                        Number(e.ctx.channelId),
                        thresholds.autoApproveHours * 60 * 60 * 1000,
                        'Pending',
                    );
                }
            } else if (
                e.toState === 'RefundFailed' &&
                // 重试再失败会经 commitState 再发布 RefundFailed→RefundFailed，必须去重，防无限登记重试
                e.fromState !== 'RefundFailed' &&
                thresholds.refundAutoRetry > 0
            ) {
                await this.afterSalesTimeoutJob.scheduleTimeout(
                    AfterSalesTimeoutType.REFUND_RETRY,
                    e.requestId,
                    Number(e.ctx.channelId),
                    30 * 60 * 1000,
                    'RefundFailed',
                    thresholds.refundAutoRetry,
                );
            }
        } catch (err: any) {
            Logger.error(
                `Schedule after-sales timeout failed for request #${e.requestId}: ${err?.message ?? err}`,
                loggerCtx,
            );
        }
    }
}
