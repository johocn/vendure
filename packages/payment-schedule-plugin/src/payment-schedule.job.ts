import { Injectable } from '@nestjs/common';
import { Channel, ChannelService, Injector, Logger, RequestContext, ScheduledTask } from '@vendure/core';

import { loggerCtx } from './constants';
import { PaymentScheduleService } from './payment-schedule.service';

@Injectable()
export class PaymentScheduleJob {
    constructor(
        private channelService: ChannelService,
        private scheduleService: PaymentScheduleService,
    ) {}

    /** 触发扫描 → 逾期扫描 → 发货超期扫描（逐渠道，避免跨租户误伤） */
    async run(ctx: RequestContext): Promise<{ activated: number; overdue: number; shipBreaches: number }> {
        const triggers = await this.scheduleService.processTriggers(ctx);
        const overdues = await this.scheduleService.processOverdue(ctx);
        const shipBreaches = await this.scheduleService.processShipDeadlines(ctx);
        return { activated: triggers.activated, overdue: overdues.overdue, shipBreaches };
    }

    /** 供 ScheduledTask 注入器调用：遍历渠道 */
    async runAllChannels(injector: Injector): Promise<{ activated: number; overdue: number; shipBreaches: number }> {
        const baseCtx = new RequestContext({
            apiType: 'admin',
            channel: new Channel(),
            authorizedAsOwnerOnly: false,
            isAuthorized: true,
        });
        const channels = await this.channelService.findAll(baseCtx);
        let total = { activated: 0, overdue: 0, shipBreaches: 0 };
        for (const channel of channels.items) {
            const channelCtx = new RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const r = await this.run(channelCtx);
                total = { activated: total.activated + r.activated, overdue: total.overdue + r.overdue, shipBreaches: total.shipBreaches + r.shipBreaches };
            } catch (e: any) {
                Logger.error(`Schedule scan failed for channel ${channel.code}: ${e.message}`, loggerCtx);
            }
        }
        return total;
    }
}

export const paymentScheduleTask = new ScheduledTask({
    id: 'payment-schedule-scan',
    description: 'Scan payment schedule triggers, overdue periods and ship deadlines',
    schedule: '* * * * *',
    timeout: 60 * 1000,
    preventOverlap: true,
    async execute({ injector }) {
        return injector.get(PaymentScheduleJob).runAllChannels(injector);
    },
});
