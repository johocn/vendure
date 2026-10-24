import { OnApplicationShutdown } from '@nestjs/common';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { DeliveryStatsService } from '../delivery-stats.service';
import { MerchantAdminService } from '../merchant-admin.service';
import { FeishuConfigService } from './feishu.config';
import { FeishuClient } from './feishu.client';
/** 当前校园时区 HH:mm */
export declare function campusHhmm(t: number): string;
/** 到达汇总时间且今天未发 → 逐群推送当天经营汇总（advisory lock + 落库标记，防多进程/重发） */
export declare class FeishuDigestService implements OnApplicationShutdown {
    private cfg;
    private client;
    private requestContextService;
    private connection;
    private merchant;
    private stats;
    private timer?;
    private running;
    private ready;
    constructor(cfg: FeishuConfigService, client: FeishuClient, requestContextService: RequestContextService, connection: TransactionalConnection, merchant: MerchantAdminService, stats: DeliveryStatsService);
    start(intervalMs?: number): void;
    onApplicationShutdown(): void;
    private tick;
    private sendOnce;
    private buildDigest;
    /** 今日 0 点（UTC+8）→ 当前已经过的毫秒数 */
    private msIntoToday;
    private ensureStateTable;
    private sentOn;
    private markSent;
}
