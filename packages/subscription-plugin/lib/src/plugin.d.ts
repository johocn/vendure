import { OnApplicationBootstrap } from '@nestjs/common';
import { ChannelService, JobQueueService, TransactionalConnection } from '@vendure/core';
import { SubscriptionService } from './subscription.service';
import { SubscriptionPluginOptions } from './types';
export declare class SubscriptionPlugin implements OnApplicationBootstrap {
    private options;
    private jobQueueService;
    private subscriptionService;
    private connection;
    private channelService;
    private static options;
    /** 每日调度定时器句柄，便于关闭。 */
    private dailyTimer?;
    constructor(options: SubscriptionPluginOptions, jobQueueService: JobQueueService, subscriptionService: SubscriptionService, connection: TransactionalConnection, channelService: ChannelService);
    static init(options?: SubscriptionPluginOptions): typeof SubscriptionPlugin;
    onApplicationBootstrap(): Promise<void>;
    /**
     * 每日调度：JobQueue 无内建 cron，故用「定时到下一次触发点 → 入队 → 重排」实现。
     * 解析 cron 的小时/分字段（形如 'M H * * *'），每天触发一次。
     */
    private scheduleNextRun;
    private parseDailyCron;
    private buildCtx;
}
