import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    Injector,
    Logger,
    RequestContext,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { GroupBuyService } from './group-buy.service';

@Injectable()
export class GroupBuyJob {
    constructor(
        private channelService: ChannelService,
        private groupBuyService: GroupBuyService,
    ) {}

    private stockPrewarmService: any = null;

    initStock(injector: Injector): void {
        try {
            const { StockPrewarmService } = require('@vendure/redis-stock-plugin');
            this.stockPrewarmService = injector.get(StockPrewarmService);
        } catch {
            // RedisStockPlugin not installed
        }
    }

    // 由 GroupBuyScheduledTask 每分钟触发，避免多实例内存 setTimeout 并发。
    // 逐渠道构建 admin ctx 后委托 GroupBuyService.processExpired 处理过期活动。
    async runCheck(ctx: RequestContext): Promise<void> {
        const channels = await this.channelService.findAll(ctx);
        for (const channel of channels.items) {
            const channelCtx = new RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const processed = await this.groupBuyService.processExpired(channelCtx);
                if (this.stockPrewarmService) {
                    for (const activity of processed) {
                        await this.stockPrewarmService.removePrewarm(`group-buy:${activity.id}`);
                    }
                }
            } catch (e: any) {
                Logger.error(`Failed to run group buy expiry check for channel ${channel.code}: ${e.message}`, loggerCtx);
            }
        }
    }
}
