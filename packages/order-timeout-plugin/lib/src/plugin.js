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
var OrderTimeoutPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderTimeoutPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const channel_custom_fields_1 = require("./channel-custom-fields");
const constants_1 = require("./constants");
const order_timeout_job_1 = require("./order-timeout.job");
const order_timeout_task_entity_1 = require("./order-timeout-task.entity");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const COMPENSATION_TASK_ID = 'order-timeout-compensation';
const compensationTask = new core_1.ScheduledTask({
    id: COMPENSATION_TASK_ID,
    description: 'Scan overdue OrderTimeoutTask records and re-enqueue them',
    schedule: cron => cron.every(5).minutes(),
    async execute({ injector }) {
        const job = injector.get(order_timeout_job_1.OrderTimeoutJob);
        await job.runCompensation();
    },
});
let OrderTimeoutPlugin = OrderTimeoutPlugin_1 = class OrderTimeoutPlugin {
    constructor(options, orderTimeoutJob, eventBus) {
        this.options = options;
        this.orderTimeoutJob = orderTimeoutJob;
        this.eventBus = eventBus;
    }
    static init(options) {
        OrderTimeoutPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return OrderTimeoutPlugin_1;
    }
    async onApplicationBootstrap() {
        await this.orderTimeoutJob.init();
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe((event) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const cf = (_a = event.ctx.channel.customFields) !== null && _a !== void 0 ? _a : {};
            const orderId = String(event.order.id);
            const channelId = String(event.ctx.channelId);
            if (event.toState === 'ArrangingPayment') {
                const minutes = (_c = (_b = cf.orderPaymentTimeoutMinutes) !== null && _b !== void 0 ? _b : this.options.defaultPaymentTimeoutMinutes) !== null && _c !== void 0 ? _c : 30;
                void this.schedule(order_timeout_task_entity_1.TimeoutType.PAYMENT, orderId, channelId, minutes * 60 * 1000);
            }
            else if (event.toState === 'Shipped') {
                const days = (_e = (_d = cf.orderReceiptTimeoutDays) !== null && _d !== void 0 ? _d : this.options.defaultReceiptTimeoutDays) !== null && _e !== void 0 ? _e : 15;
                void this.schedule(order_timeout_task_entity_1.TimeoutType.RECEIPT, orderId, channelId, days * 24 * 60 * 60 * 1000);
            }
            else if (event.toState === 'Delivered') {
                const days = (_g = (_f = cf.orderReviewReminderDays) !== null && _f !== void 0 ? _f : this.options.defaultReviewReminderDays) !== null && _g !== void 0 ? _g : 7;
                void this.schedule(order_timeout_task_entity_1.TimeoutType.REVIEW, orderId, channelId, days * 24 * 60 * 60 * 1000);
            }
        });
        this.eventBus.ofType(core_1.PaymentStateTransitionEvent).subscribe((event) => {
            var _a, _b, _c;
            if (event.toState !== 'Settled')
                return;
            const cf = (_a = event.ctx.channel.customFields) !== null && _a !== void 0 ? _a : {};
            const hours = (_c = (_b = cf.orderFulfillmentTimeoutHours) !== null && _b !== void 0 ? _b : this.options.defaultFulfillmentTimeoutHours) !== null && _c !== void 0 ? _c : 48;
            void this.schedule(order_timeout_task_entity_1.TimeoutType.FULFILLMENT, String(event.order.id), String(event.ctx.channelId), hours * 60 * 60 * 1000);
        });
        core_1.Logger.info('OrderTimeoutPlugin initialized', constants_1.loggerCtx);
    }
    async schedule(type, orderId, channelId, timeoutMs) {
        var _a;
        try {
            await this.orderTimeoutJob.scheduleTimeout(type, orderId, channelId, timeoutMs);
        }
        catch (e) {
            core_1.Logger.error(`Failed to schedule ${type} timeout for order ${orderId}: ${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, constants_1.loggerCtx);
        }
    }
};
exports.OrderTimeoutPlugin = OrderTimeoutPlugin;
OrderTimeoutPlugin.options = {};
exports.OrderTimeoutPlugin = OrderTimeoutPlugin = OrderTimeoutPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [order_timeout_task_entity_1.OrderTimeoutTask],
        providers: [
            { provide: constants_1.ORDER_TIMEOUT_PLUGIN_OPTIONS, useFactory: () => OrderTimeoutPlugin.options },
            order_timeout_job_1.OrderTimeoutJob,
        ],
        configuration: (config) => {
            config.customFields.Channel = mergeCustomFields(config.customFields.Channel, channel_custom_fields_1.orderTimeoutChannelCustomFields.Channel);
            const exists = config.schedulerOptions.tasks.some(t => t.id === COMPENSATION_TASK_ID);
            if (!exists) {
                config.schedulerOptions.tasks.push(compensationTask);
            }
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.ORDER_TIMEOUT_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, order_timeout_job_1.OrderTimeoutJob,
        core_1.EventBus])
], OrderTimeoutPlugin);
//# sourceMappingURL=plugin.js.map