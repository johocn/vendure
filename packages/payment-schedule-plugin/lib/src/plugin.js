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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PaymentSchedulePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentSchedulePlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const order_payment_schedule_entity_1 = require("./order-payment-schedule.entity");
const order_schedule_item_entity_1 = require("./order-schedule-item.entity");
const payment_schedule_admin_resolver_1 = require("./payment-schedule-admin.resolver");
const order_custom_fields_1 = require("./order-custom-fields");
const payment_schedule_job_1 = require("./payment-schedule.job");
const payment_schedule_order_process_1 = require("./payment-schedule.order-process");
const payment_schedule_service_1 = require("./payment-schedule.service");
const payment_schedule_runtime_1 = require("./payment-schedule-runtime");
const payment_schedule_shop_resolver_1 = require("./payment-schedule-shop.resolver");
/** 幂等合并 customFields（防 preBootstrapConfig 重复注册），与 pre-sale 同款 */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
let PaymentSchedulePlugin = PaymentSchedulePlugin_1 = class PaymentSchedulePlugin {
    constructor(options, scheduleService, eventBus, moduleRef) {
        this.options = options;
        this.scheduleService = scheduleService;
        this.eventBus = eventBus;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        PaymentSchedulePlugin_1.options = options !== null && options !== void 0 ? options : {};
        return PaymentSchedulePlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        (0, payment_schedule_runtime_1.setPaymentScheduleRuntime)(this.injector.get(core_2.TransactionalConnection), this.injector);
        this.scheduleService.init(this.injector);
        // 订单取消 → 调度联动（未付期次 waived、调度 cancelled）
        this.eventBus.ofType(core_2.OrderStateTransitionEvent).subscribe(async (event) => {
            var _a, _b;
            if (event.toState !== 'Cancelled')
                return;
            if (!((_b = (_a = event.order) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.paymentScheduleId))
                return;
            try {
                await this.scheduleService.handleOrderCancelled(event.ctx, event.order.id);
            }
            catch (e) {
                core_2.Logger.error(`Failed to handle schedule on order cancel: ${e.message}`, constants_1.loggerCtx);
            }
        });
        // 团购领域事件桥（软依赖 group-buy-plugin）
        this.registerGroupBuyBridge();
        core_2.Logger.info('PaymentSchedulePlugin initialized', constants_1.loggerCtx);
    }
    registerGroupBuyBridge() {
        try {
            const gb = require('@vendure/group-buy-plugin');
            this.eventBus.ofType(gb.GroupBuyCompletedEvent).subscribe((e) => this.scheduleService.handleGroupBuyCompleted(e.ctx, e.activityId).catch((err) => {
                core_2.Logger.error(`GroupBuyCompleted schedule handling failed: ${err.message}`, constants_1.loggerCtx);
            }));
            this.eventBus.ofType(gb.GroupBuyFailedEvent).subscribe((e) => this.scheduleService.handleGroupBuyFailed(e.ctx, e.activityId).catch((err) => {
                core_2.Logger.error(`GroupBuyFailed schedule handling failed: ${err.message}`, constants_1.loggerCtx);
            }));
            core_2.Logger.info('Group-buy event bridge registered', constants_1.loggerCtx);
        }
        catch (_a) {
            core_2.Logger.info('group-buy-plugin not installed, group_buy triggers use scanner only', constants_1.loggerCtx);
        }
    }
};
exports.PaymentSchedulePlugin = PaymentSchedulePlugin;
PaymentSchedulePlugin.options = {};
exports.PaymentSchedulePlugin = PaymentSchedulePlugin = PaymentSchedulePlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [order_payment_schedule_entity_1.OrderPaymentSchedule, order_schedule_item_entity_1.OrderScheduleItem],
        providers: [
            { provide: constants_1.PAYMENT_SCHEDULE_PLUGIN_OPTIONS, useFactory: () => PaymentSchedulePlugin.options },
            payment_schedule_service_1.PaymentScheduleService,
            // 供 ScheduledTask injector.get(PaymentScheduleJob)
            payment_schedule_job_1.PaymentScheduleJob,
            // 注意：Resolver 类不放 providers——放这里会被 nest resolver explorer 扫进两个 API 的
            // resolver map（admin resolver 泄漏到 shop schema 报 "defined in resolvers, but not in schema"），
            // 正确位置是下方 adminApiExtensions/shopApiExtensions 的 resolvers 数组（经 DynamicPluginApiModule 按 API 分侧注册）。
        ],
        exports: [payment_schedule_service_1.PaymentScheduleService],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            enum PaymentScheduleScenario { presale installment rental }
            enum PaymentScheduleStatus { pending in_progress completed breached cancelled }
            enum PaymentScheduleBreachType { buyer_timeout seller_breach group_buy_failed }
            enum PaymentScheduleItemStatus { locked payable paid overdue forfeited refunded waived }
            enum PaymentScheduleItemKind { deposit balance down_payment installment rent buyout }

            type PaymentScheduleItem implements Node {
                id: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
                seq: Int!
                kind: PaymentScheduleItemKind!
                amount: Int!
                paidAmount: Int!
                allowCod: Boolean!
                status: PaymentScheduleItemStatus!
                dueAt: DateTime
                graceHours: Int!
                trigger: JSON!
                paidAt: DateTime
                lateFeeAccrued: Int!
            }

            type PaymentSchedule implements Node {
                id: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
                orderId: ID!
                scenario: PaymentScheduleScenario!
                status: PaymentScheduleStatus!
                breachType: PaymentScheduleBreachType
                depositRule: JSON
                deliveryGate: String!
                agreementVersion: String!
                shipDeadline: DateTime
                meta: JSON
                items: [PaymentScheduleItem!]!
                paidTotal: Int!
                totalAmount: Int!
            }

            input PaymentScheduleListOptions

            type PaymentScheduleList implements PaginatedList {
                items: [PaymentSchedule!]!
                totalItems: Int!
            }

            extend type Query {
                paymentSchedules(options: PaymentScheduleListOptions): PaymentScheduleList!
                adminPaymentSchedule(id: ID!): PaymentSchedule
            }

            extend type Mutation {
                openTailWindow(scheduleId: ID!): PaymentSchedule!
                confirmSellerBreach(scheduleId: ID!): PaymentSchedule!
                confirmCodReceived(orderId: ID!): PaymentSchedule!
                releaseRentalDeposit(orderId: ID!): PaymentSchedule!
                runScheduleScan: PaymentScheduleScanResult!
            }

            type PaymentScheduleScanResult {
                activated: Int!
                overdue: Int!
                shipBreaches: Int!
            }
        `,
            resolvers: [payment_schedule_admin_resolver_1.PaymentScheduleAdminResolver],
        },
        shopApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            enum PaymentScheduleScenario { presale installment rental }
            enum PaymentScheduleStatus { pending in_progress completed breached cancelled }
            enum PaymentScheduleBreachType { buyer_timeout seller_breach group_buy_failed }
            enum PaymentScheduleItemStatus { locked payable paid overdue forfeited refunded waived }
            enum PaymentScheduleItemKind { deposit balance down_payment installment rent buyout }

            type PaymentScheduleItem implements Node {
                id: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
                seq: Int!
                kind: PaymentScheduleItemKind!
                amount: Int!
                paidAmount: Int!
                allowCod: Boolean!
                status: PaymentScheduleItemStatus!
                dueAt: DateTime
                graceHours: Int!
                trigger: JSON!
                paidAt: DateTime
                lateFeeAccrued: Int!
            }

            type PaymentSchedule implements Node {
                id: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
                orderId: ID!
                scenario: PaymentScheduleScenario!
                status: PaymentScheduleStatus!
                breachType: PaymentScheduleBreachType
                depositRule: JSON
                deliveryGate: String!
                agreementVersion: String!
                shipDeadline: DateTime
                meta: JSON
                items: [PaymentScheduleItem!]!
                paidTotal: Int!
                totalAmount: Int!
            }

            extend type Query {
                paymentSchedule(orderId: ID!): PaymentSchedule
            }

            extend type Mutation {
                paySchedulePeriod(orderId: ID!, seq: Int!, method: String!): PaymentSchedule!
                cancelSchedule(orderId: ID!, confirmForfeit: Boolean): PaymentSchedule!
            }
        `,
            resolvers: [payment_schedule_shop_resolver_1.PaymentScheduleShopResolver],
        },
        configuration: config => {
            var _a, _b;
            config.customFields.Order = mergeCustomFields(config.customFields.Order, order_custom_fields_1.paymentScheduleOrderCustomFields.Order);
            const orderProcesses = (_b = (_a = config.orderOptions) === null || _a === void 0 ? void 0 : _a.process) !== null && _b !== void 0 ? _b : [];
            const registered = orderProcesses.some((p) => p.__paymentScheduleRegistered);
            if (!registered) {
                payment_schedule_order_process_1.paymentScheduleOrderProcess.__paymentScheduleRegistered = true;
                config.orderOptions.process = [...orderProcesses, payment_schedule_order_process_1.paymentScheduleOrderProcess];
            }
            if (!config.schedulerOptions) {
                config.schedulerOptions = { tasks: [] };
            }
            if (!config.schedulerOptions.tasks) {
                config.schedulerOptions.tasks = [];
            }
            config.schedulerOptions.tasks.push(payment_schedule_job_1.paymentScheduleTask);
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.PAYMENT_SCHEDULE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, payment_schedule_service_1.PaymentScheduleService,
        core_2.EventBus,
        core_1.ModuleRef])
], PaymentSchedulePlugin);
