import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
export type CapacitySeverity = 'critical' | 'warning';
export interface CapacityAlertSettings {
    /** 总开关（CAPACITY_ALERT_ENABLED，默认开） */
    enabled: boolean;
    /** 扫描周期（CAPACITY_ALERT_INTERVAL_MIN，默认 5 分钟） */
    intervalMs: number;
    /** 启动首跑延迟，等连接池/事件总线就绪（CAPACITY_ALERT_BOOT_DELAY_SEC，默认 60s） */
    bootDelayMs: number;
    /** 同渠道同级别告警冷却（CAPACITY_ALERT_COOLDOWN_MIN，默认 30 分钟） */
    cooldownMs: number;
    /** 无在线骑手时触发告警的待抢单量下限（CAPACITY_ALERT_NO_RIDER_BACKLOG，默认 1） */
    noRiderBacklog: number;
    /** 运力紧张：待抢单量下限（CAPACITY_ALERT_TIGHT_BACKLOG，默认 5） */
    tightBacklog: number;
    /** 运力紧张：在线骑手数上限（CAPACITY_ALERT_TIGHT_RIDERS，默认 2） */
    tightRiders: number;
    /** 严重告警是否 @所有人（CAPACITY_ALERT_AT_ALL，默认开） */
    atAll: boolean;
    /** 只对这些渠道 code 告警，空 = 全部（CAPACITY_ALERT_CHANNELS，逗号分隔） */
    channels: string[];
}
export declare function readCapacityAlertSettings(env?: NodeJS.ProcessEnv): CapacityAlertSettings;
/**
 * 调度看板链接：优先 CAPACITY_ALERT_LINK；否则按 ADMIN_UI_BASE_URL（origin 或已带 /guanli）拼后台运营中心。
 */
export declare function capacityOpsLink(env?: NodeJS.ProcessEnv): string;
/** 待抢单量 + 最久等待时长 */
export interface BacklogStat {
    count: number;
    oldestMinutes: number;
}
/**
 * 运力预警定时器（生产单进程，自管 setInterval；与 PaymentTimeoutJob / DispatchJobService 同形态）：
 * 1) 关闭心跳超时的骑手在线会话（在线时长统计收口）；
 * 2) 按渠道统计「待抢大厅单量 vs 5min 内在线骑手数」，分级告警推飞书（严格项 @所有人），
 *    恢复健康后补一条「运力已恢复」，避免运营只看到告警看不到恢复。
 *
 * 推送口径：店铺定向（channel 群 + 平台群），店铺名优先 channel.customFields.shopName；
 * 死信保护：仅送达成功才登记冷却，推送失败下一轮重试。
 */
export declare class CapacityAlertJob implements OnApplicationShutdown {
    private connection;
    private feishu;
    private timer;
    private bootTimer;
    private running;
    /** channelId → 上次告警时间（冷却用） */
    private alerted;
    /** channelId → 当前级别（用于升级立即推 / 恢复通知） */
    private severity;
    private settings;
    constructor(connection: TransactionalConnection, feishu: FeishuNotifyService);
    /** 运维/单测覆盖阈值（start 时会用环境变量重置） */
    configure(partial: Partial<CapacityAlertSettings>): void;
    start(overrides?: Partial<CapacityAlertSettings>): void;
    stop(): void;
    onApplicationShutdown(): void;
    run(): Promise<void>;
    /** 心跳超过 5min 的会话按最后心跳关账 */
    closeStaleSessions(): Promise<void>;
    private severityOf;
    private buildContent;
    private pushRecovered;
    private countOnlineRiders;
    private countBacklog;
    private canAlert;
    /** 去重键时间槽：冷却为 0 时按分钟分桶（避免除零） */
    private bucket;
    /** 原始查询结果归一化（pg 驱动返回 [rows, count] 两层数组） */
    private query;
}
