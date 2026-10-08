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
exports.paymentScheduleTask = exports.PaymentScheduleJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const payment_schedule_service_1 = require("./payment-schedule.service");
let PaymentScheduleJob = class PaymentScheduleJob {
    constructor(channelService, scheduleService) {
        this.channelService = channelService;
        this.scheduleService = scheduleService;
    }
    /** 触发扫描 → 逾期扫描 → 发货超期扫描（逐渠道，避免跨租户误伤） */
    async run(ctx) {
        const triggers = await this.scheduleService.processTriggers(ctx);
        const overdues = await this.scheduleService.processOverdue(ctx);
        const shipBreaches = await this.scheduleService.processShipDeadlines(ctx);
        return { activated: triggers.activated, overdue: overdues.overdue, shipBreaches };
    }
    /** 供 ScheduledTask 注入器调用：遍历渠道 */
    async runAllChannels(injector) {
        const baseCtx = new core_1.RequestContext({
            apiType: 'admin',
            channel: new core_1.Channel(),
            authorizedAsOwnerOnly: false,
            isAuthorized: true,
        });
        const channels = await this.channelService.findAll(baseCtx);
        let total = { activated: 0, overdue: 0, shipBreaches: 0 };
        for (const channel of channels.items) {
            const channelCtx = new core_1.RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const r = await this.run(channelCtx);
                total = { activated: total.activated + r.activated, overdue: total.overdue + r.overdue, shipBreaches: total.shipBreaches + r.shipBreaches };
            }
            catch (e) {
                core_1.Logger.error(`Schedule scan failed for channel ${channel.code}: ${e.message}`, constants_1.loggerCtx);
            }
        }
        return total;
    }
};
exports.PaymentScheduleJob = PaymentScheduleJob;
exports.PaymentScheduleJob = PaymentScheduleJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService,
        payment_schedule_service_1.PaymentScheduleService])
], PaymentScheduleJob);
exports.paymentScheduleTask = new core_1.ScheduledTask({
    id: 'payment-schedule-scan',
    description: 'Scan payment schedule triggers, overdue periods and ship deadlines',
    schedule: '* * * * *',
    timeout: 60 * 1000,
    preventOverlap: true,
    async execute({ injector }) {
        return injector.get(PaymentScheduleJob).runAllChannels(injector);
    },
});
