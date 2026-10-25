import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
/**
 * 运力预警定时器（生产单进程，自管 setInterval；与 PaymentTimeoutJob / DispatchJobService 同形态）：
 * 1) 关闭心跳超时的骑手在线会话（在线时长统计收口）；
 * 2) 按渠道统计「待抢大厅单量 vs 5min 内在线骑手数」，触发无骑手 / 运力紧张告警推飞书。
 */
export declare class CapacityAlertJob implements OnApplicationShutdown {
    private connection;
    private feishu;
    private timer;
    private bootTimer;
    private running;
    private alerted;
    constructor(connection: TransactionalConnection, feishu: FeishuNotifyService);
    start(intervalMs?: number): void;
    stop(): void;
    onApplicationShutdown(): void;
    run(): Promise<void>;
    /** 心跳超过 5min 的会话按最后心跳关账 */
    closeStaleSessions(): Promise<void>;
    private countOnlineRiders;
    private countBacklog;
    private shouldAlert;
    /** 原始查询结果归一化（pg 驱动返回 [rows, count] 两层数组） */
    private query;
}
