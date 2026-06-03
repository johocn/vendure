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
const constants_1 = require("./constants");
const channel_custom_fields_1 = require("./channel-custom-fields");
const order_timeout_job_1 = require("./order-timeout.job");
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
            var _a, _b, _c;
            if (event.toState === 'ArrangingPayment') {
                const timeoutMinutes = (_c = (_b = (_a = event.ctx.channel.customFields) === null || _a === void 0 ? void 0 : _a.orderTimeoutMinutes) !== null && _b !== void 0 ? _b : this.options.defaultTimeoutMinutes) !== null && _c !== void 0 ? _c : 30;
                void this.orderTimeoutJob.scheduleCancellation(event.order.id, event.ctx.channelId, timeoutMinutes);
                core_1.Logger.info(`Scheduled timeout for order ${String(event.order.id)} in ${String(timeoutMinutes)} minutes`, constants_1.loggerCtx);
            }
        });
    }
};
exports.OrderTimeoutPlugin = OrderTimeoutPlugin;
OrderTimeoutPlugin.options = {};
exports.OrderTimeoutPlugin = OrderTimeoutPlugin = OrderTimeoutPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.ORDER_TIMEOUT_PLUGIN_OPTIONS, useFactory: () => OrderTimeoutPlugin.options },
            order_timeout_job_1.OrderTimeoutJob,
        ],
        configuration: (config) => {
            var _a, _b;
            config.customFields.Channel = [
                ...((_a = config.customFields.Channel) !== null && _a !== void 0 ? _a : []),
                ...(_b = channel_custom_fields_1.orderTimeoutChannelCustomFields.Channel) !== null && _b !== void 0 ? _b : [],
            ];
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