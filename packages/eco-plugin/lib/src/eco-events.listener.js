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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcoEventsListener = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const distribution_plugin_1 = require("@vendure/distribution-plugin");
const constants_1 = require("./constants");
const eco_reporter_service_1 = require("./eco-reporter.service");
const sso_id_1 = require("./sso-id");
/**
 * 生态行为监听器：
 * - purchase：订单支付成功后（OrderPlacedEvent，每单恰好一次）上报下单用户
 * - distribute：分销直接佣金落库后（distribution-plugin 发布的 CommissionRecordCreatedEvent）上报 inviter
 * 所有处理均 try/catch 兜底 + fire-and-forget，失败绝不影响订单/佣金主流程。
 */
let EcoEventsListener = class EcoEventsListener {
    constructor(eventBus, orderService, customerService, reporter) {
        this.eventBus = eventBus;
        this.orderService = orderService;
        this.customerService = customerService;
        this.reporter = reporter;
    }
    /** 由 EcoPlugin.onApplicationBootstrap 调用，避免 Nest 生命周期重复触发 */
    init() {
        this.eventBus.ofType(core_1.OrderPlacedEvent).subscribe(event => {
            void this.reportPurchase(event.ctx, event.order.id).catch(() => undefined);
        });
        this.eventBus.ofType(distribution_plugin_1.CommissionRecordCreatedEvent).subscribe(event => {
            void this.reportDistribute(event).catch(() => undefined);
        });
    }
    async reportPurchase(ctx, orderId) {
        try {
            const order = await this.orderService.findOne(ctx, orderId, ['customer']);
            const ssoId = (0, sso_id_1.extractSsoId)(order === null || order === void 0 ? void 0 : order.customer);
            if (!ssoId || !order) {
                core_1.Logger.info(`purchase 上报跳过：订单 ${orderId} 无 SSO 身份`, constants_1.loggerCtx);
                return;
            }
            this.reporter.report(ssoId, 'purchase', order.code);
        }
        catch (e) {
            core_1.Logger.warn(`purchase 上报处理失败 order=${orderId}: ${e.message}`, constants_1.loggerCtx);
        }
    }
    async reportDistribute(event) {
        try {
            const customer = await this.customerService.findOne(event.ctx, event.distributorCustomerId);
            const ssoId = (0, sso_id_1.extractSsoId)(customer);
            if (!ssoId) {
                core_1.Logger.info(`distribute 上报跳过：inviter customer ${event.distributorCustomerId} 无 SSO 身份`, constants_1.loggerCtx);
                return;
            }
            this.reporter.report(ssoId, 'distribute', event.orderCode);
        }
        catch (e) {
            core_1.Logger.warn(`distribute 上报处理失败 order=${event.orderId}: ${e.message}`, constants_1.loggerCtx);
        }
    }
};
exports.EcoEventsListener = EcoEventsListener;
exports.EcoEventsListener = EcoEventsListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.EventBus,
        core_1.OrderService,
        core_1.CustomerService,
        eco_reporter_service_1.EcoReporter])
], EcoEventsListener);
//# sourceMappingURL=eco-events.listener.js.map