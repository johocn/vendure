import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
/** 取消统计窗口（天） */
export declare const BLACKLIST_CANCEL_WINDOW_DAYS = 30;
/**
 * P3-2 黑名单自动规则：近 30 天「顾客主动取消」订单达到店铺阈值（blacklistAutoCancelCount）
 * 的顾客自动加入黑名单。
 *
 * 取消归因由插件在订单转 Cancelled 时写入 customFieldsCampuscancelcause（customer/system/ops），
 * 只统计 customer，避免把超时/无骑手等系统取消误判成顾客恶意取消。
 *
 * 生产为单进程（pm2 只跑 API），沿用本插件自管定时器；阈值 0 = 关闭，默认不改变既有行为。
 */
export declare class BlacklistAutoScanJob implements OnApplicationShutdown {
    private connection;
    private feishu;
    private fallback;
    private lastRunDay;
    constructor(connection: TransactionalConnection, feishu: FeishuNotifyService);
    start(): void;
    stop(): void;
    onApplicationShutdown(): void;
    /** 每日一轮：同日重复触发直接跳过（force 供手动/测试） */
    runOnce(force?: boolean): Promise<{
        added: number;
        channels: number;
    }>;
    scan(): Promise<{
        added: number;
        channels: number;
    }>;
}
