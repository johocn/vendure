import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { FeishuConfigService } from './feishu.config';
import { FeishuClient } from './feishu.client';
import { FeishuCommandService } from './feishu.command.service';
/** 当前校园时区 HH:mm */
export declare function campusHhmm(t: number): string;
/**
 * 到达汇总时间且今天未发 → 逐群推送当天经营汇总。
 * 零建表：防重不落库，发送前用飞书消息列表接口回读当天是否已有「【每日汇总】」；
 * 多进程并发仍用 PG advisory lock 兜底（不建表）。
 */
export declare class FeishuDigestService implements OnApplicationShutdown {
    private cfg;
    private client;
    private connection;
    private command;
    private timer?;
    private running;
    /** 进程内兜底（webhook 模式无法回读消息时防同进程重复发送，不落库） */
    private sent;
    constructor(cfg: FeishuConfigService, client: FeishuClient, connection: TransactionalConnection, command: FeishuCommandService);
    start(intervalMs?: number): void;
    onApplicationShutdown(): void;
    private tick;
    private sendOnce;
    /** 汇总内容由指令服务统一生成：平台群走全平台，店铺群走单店 */
    private buildDigest;
    /** 回读当天群消息，已有当日「【每日汇总】」则跳过（最多翻 5 页，纯读）
     * 只从当日汇总时间点开始算，避免早上人工查过一次汇总就把定时汇总吞掉 */
    private sentToday;
    private sentHeartbeat;
    private heartbeatTick;
    private gcSentHeartbeat;
    /** 轻量心跳：活动中订单数（非终态）+ 店铺数 + 系统时间戳，一次 COUNT 搞定 */
    private buildHeartbeat;
}
