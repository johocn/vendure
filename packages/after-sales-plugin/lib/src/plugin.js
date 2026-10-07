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
var AfterSalesPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AfterSalesPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const after_sales_request_entity_1 = require("./after-sales-request.entity");
const after_sales_state_history_entity_1 = require("./after-sales-state-history.entity");
const after_sales_message_entity_1 = require("./after-sales-message.entity");
const after_sales_service_1 = require("./after-sales.service");
const after_sales_shop_resolver_1 = require("./after-sales-shop.resolver");
const after_sales_admin_resolver_1 = require("./after-sales-admin.resolver");
const order_custom_fields_1 = require("./order-custom-fields");
const after_sales_events_1 = require("./after-sales.events");
const after_sales_config_1 = require("./after-sales-config");
const after_sales_timeout_job_1 = require("./after-sales-timeout.job");
const after_sales_timeout_entity_1 = require("./after-sales-timeout.entity");
const { gql } = require('graphql-tag');
const COMPENSATION_TASK_ID = 'after-sales-timeout-compensation';
const compensationTask = new core_2.ScheduledTask({
    id: COMPENSATION_TASK_ID,
    description: 'Scan overdue AfterSalesTimeoutTask records and re-enqueue them',
    schedule: cron => cron.every(5).minutes(),
    async execute({ injector }) {
        const job = injector.get(after_sales_timeout_job_1.AfterSalesTimeoutJob);
        await job.runCompensation();
    },
});
let AfterSalesPlugin = AfterSalesPlugin_1 = class AfterSalesPlugin {
    constructor(options, afterSalesService, afterSalesTimeoutJob, eventBus, moduleRef) {
        this.options = options;
        this.afterSalesService = afterSalesService;
        this.afterSalesTimeoutJob = afterSalesTimeoutJob;
        this.eventBus = eventBus;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        AfterSalesPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return AfterSalesPlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.afterSalesService.init(this.injector);
        await this.afterSalesTimeoutJob.init();
        // 状态流转 → 登记超时任务（Pending 提醒 / Pending 自动同意 / RefundFailed 重试）
        this.eventBus.ofType(after_sales_events_1.AfterSalesStateTransitionEvent).subscribe((e) => {
            void this.onAfterSalesStateTransition(e);
        });
        core_2.Logger.info('AfterSalesPlugin initialized', constants_1.loggerCtx);
    }
    async onAfterSalesStateTransition(e) {
        var _a;
        try {
            const thresholds = await (0, after_sales_config_1.resolveAfterSalesThresholds)(this.injector, e.ctx, e.ctx.channelId, AfterSalesPlugin_1.options);
            if (e.toState === 'Pending' && e.fromState === null) {
                await this.afterSalesTimeoutJob.scheduleTimeout(after_sales_timeout_entity_1.AfterSalesTimeoutType.PENDING_REMIND, e.requestId, Number(e.ctx.channelId), thresholds.timeoutHours * 60 * 60 * 1000, 'Pending');
                if (thresholds.autoApproveHours > 0) {
                    await this.afterSalesTimeoutJob.scheduleTimeout(after_sales_timeout_entity_1.AfterSalesTimeoutType.PENDING_AUTO_APPROVE, e.requestId, Number(e.ctx.channelId), thresholds.autoApproveHours * 60 * 60 * 1000, 'Pending');
                }
            }
            else if (e.toState === 'RefundFailed' &&
                // 重试再失败会经 commitState 再发布 RefundFailed→RefundFailed，必须去重，防无限登记重试
                e.fromState !== 'RefundFailed' &&
                thresholds.refundAutoRetry > 0) {
                await this.afterSalesTimeoutJob.scheduleTimeout(after_sales_timeout_entity_1.AfterSalesTimeoutType.REFUND_RETRY, e.requestId, Number(e.ctx.channelId), 30 * 60 * 1000, 'RefundFailed', thresholds.refundAutoRetry);
            }
        }
        catch (err) {
            core_2.Logger.error(`Schedule after-sales timeout failed for request #${e.requestId}: ${(_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err}`, constants_1.loggerCtx);
        }
    }
};
exports.AfterSalesPlugin = AfterSalesPlugin;
AfterSalesPlugin.options = {};
exports.AfterSalesPlugin = AfterSalesPlugin = AfterSalesPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [after_sales_request_entity_1.AfterSalesRequest, after_sales_state_history_entity_1.AfterSalesStateHistory, after_sales_message_entity_1.AfterSalesMessage, after_sales_timeout_entity_1.AfterSalesTimeoutTask],
        providers: [
            { provide: constants_1.AFTER_SALES_PLUGIN_OPTIONS, useFactory: () => AfterSalesPlugin.options },
            after_sales_service_1.AfterSalesService,
            after_sales_timeout_job_1.AfterSalesTimeoutJob,
        ],
        exports: [after_sales_service_1.AfterSalesService],
        shopApiExtensions: {
            schema: () => gql `
            enum AfterSalesType { return_refund refund_only exchange }
            enum AfterSalesState { Pending Approved Rejected Appealed Returning Received ExchangeShipped Refunded RefundFailed Closed }

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

                """被拒后申诉：Rejected → Appealed（申诉说明进入协商留言流）"""
                appealAfterSalesRequest(id: ID!, note: String!): AfterSalesRequest!
            }
        `,
            resolvers: [after_sales_shop_resolver_1.AfterSalesShopResolver],
        },
        adminApiExtensions: {
            schema: () => gql `
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

            type AfterSalesDaily {
                date: String!
                total: Int!
            }

            type AfterSalesBucket {
                key: String!
                count: Int!
                amount: Int!
            }

            type AfterSalesStats {
                totalRequests: Int!
                pendingCount: Int!
                totalRefundAmount: Int!
                avgHandleHours: Float
                daily: [AfterSalesDaily!]!
                byState: [AfterSalesBucket!]!
                byType: [AfterSalesBucket!]!
            }

            extend type Query {
                afterSalesRequests(options: AfterSalesRequestAdminListOptions): AfterSalesRequestAdminList!
                afterSalesRequestAdmin(id: ID!): AfterSalesRequestAdmin
                afterSalesReturnAddress: String!
                afterSalesStats(from: String!, to: String!): AfterSalesStats!
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

                """平台仲裁：Appealed → Approved（同意，refund_only 即退款）| Closed（维持拒绝，note 必填）"""
                arbitrateAfterSales(id: ID!, approve: Boolean!, note: String): AfterSalesRequestAdmin!
            }
        `,
            resolvers: [after_sales_admin_resolver_1.AfterSalesAdminResolver],
        },
        configuration: (config) => {
            var _a, _b, _c, _d;
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [
                    ...((_b = (_a = config.customFields) === null || _a === void 0 ? void 0 : _a.Order) !== null && _b !== void 0 ? _b : []),
                    ...order_custom_fields_1.afterSalesOrderCustomFields.Order,
                ], Channel: [
                    ...((_d = (_c = config.customFields) === null || _c === void 0 ? void 0 : _c.Channel) !== null && _d !== void 0 ? _d : []),
                    {
                        name: 'afterSalesReturnAddress',
                        type: 'string',
                        nullable: true,
                        label: [{ languageCode: core_2.LanguageCode.zh_Hans, value: '售后寄回地址' }],
                    },
                    {
                        name: 'afterSalesTimeoutHours',
                        type: 'int',
                        defaultValue: 48,
                        label: [{ languageCode: core_2.LanguageCode.zh_Hans, value: '售后待处理超时提醒（小时）' }],
                    },
                    {
                        name: 'afterSalesAutoApproveHours',
                        type: 'int',
                        defaultValue: 0,
                        label: [{ languageCode: core_2.LanguageCode.zh_Hans, value: '售后超时自动同意（小时，0=关闭）' }],
                    },
                    {
                        name: 'afterSalesRefundAutoRetry',
                        type: 'int',
                        defaultValue: 1,
                        label: [{ languageCode: core_2.LanguageCode.zh_Hans, value: '退款失败自动重试次数（0=关闭）' }],
                    },
                ] });
            const exists = config.schedulerOptions.tasks.some(t => t.id === COMPENSATION_TASK_ID);
            if (!exists) {
                config.schedulerOptions.tasks.push(compensationTask);
            }
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.AFTER_SALES_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, after_sales_service_1.AfterSalesService,
        after_sales_timeout_job_1.AfterSalesTimeoutJob,
        core_2.EventBus,
        core_1.ModuleRef])
], AfterSalesPlugin);
//# sourceMappingURL=plugin.js.map