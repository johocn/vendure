import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
/**
 * R8 遗留巡检（默认每日 09:00，UTC+8）：把「会静默卡住」的残留量汇总推送到平台群。
 * 全部指标为只读 COUNT；任一查询失败记为 -1 并跳过该项，不影响其余指标。
 * 多实例安全：PG advisory lock + 进程内按天去重（与飞书汇总同模式）。
 */
export declare class OpsCheckJob implements OnApplicationShutdown {
    private connection;
    private feishu;
    private fallback;
    private sentDay;
    /** 巡检时间（HH:mm，UTC+8），默认 09:00 */
    private readonly at;
    constructor(connection: TransactionalConnection, feishu: FeishuNotifyService);
    start(intervalMs?: number): void;
    onApplicationShutdown(): void;
    /** 执行一次巡检；已过巡检时间且当日未发送时推送，返回推送文本（未触发/全为零返回 null） */
    runOnce(now?: number): Promise<string | null>;
    private collect;
}
