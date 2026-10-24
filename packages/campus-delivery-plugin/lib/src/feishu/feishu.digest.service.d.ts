import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { FeishuConfigService } from './feishu.config';
import { FeishuClient } from './feishu.client';
import { FeishuCommandService } from './feishu.command.service';
/** 当前校园时区 HH:mm */
export declare function campusHhmm(t: number): string;
/** 到达汇总时间且今天未发 → 逐群推送当天经营汇总（advisory lock + 落库标记，防多进程/重发） */
export declare class FeishuDigestService implements OnApplicationShutdown {
    private cfg;
    private client;
    private connection;
    private command;
    private timer?;
    private running;
    private ready;
    constructor(cfg: FeishuConfigService, client: FeishuClient, connection: TransactionalConnection, command: FeishuCommandService);
    start(intervalMs?: number): void;
    onApplicationShutdown(): void;
    private tick;
    private sendOnce;
    /** 汇总内容由指令服务统一生成：平台群走全平台，店铺群走单店 */
    private buildDigest;
    private ensureStateTable;
    private sentOn;
    private markSent;
}
