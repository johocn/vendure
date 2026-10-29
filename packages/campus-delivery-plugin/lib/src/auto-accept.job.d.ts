import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { MerchantAdminService } from './merchant-admin.service';
/**
 * 商家自动接单（§69）：营业中且未临时休息的店铺，待接单订单超过「延迟秒数」后自动确认，
 * 与手动接单同一条状态机（条件写防并发 + 用户通知 + 接单即出票）。
 * 每日自动接单达到上限后新单退回人工接单；休息中/非营业时段不自动接（避免无人出餐）。
 * 店铺可在经营设置关闭；渠道间用咨询锁隔离，多实例部署幂等。
 */
export declare class AutoAcceptJob implements OnApplicationShutdown {
    private connection;
    private config;
    private merchant;
    private timer;
    private bootTimer;
    private running;
    constructor(connection: TransactionalConnection, config: CampusConfigService, merchant: MerchantAdminService);
    start(): void;
    stop(): void;
    onApplicationShutdown(): void;
    /** 扫描全部渠道（仅启用了自动接单的渠道有额外开销） */
    run(): Promise<void>;
    private runChannelWithLock;
    runChannel(channelId: number): Promise<void>;
}
