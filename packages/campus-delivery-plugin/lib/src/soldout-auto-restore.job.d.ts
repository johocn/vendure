import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
/**
 * 沽清次日自动恢复（§66）：每天 04:00 把「全店沽清」批次登记的商品恢复在售，
 * 并清空登记。单品手动沽清不会进入批次表，因此不受影响。
 * 店铺可在后台关闭自动恢复（channel.customFields.waimaiSoldOutAutoRestore）。
 */
export declare class SoldOutAutoRestoreJob implements OnApplicationShutdown {
    private connection;
    private timer;
    private bootTimer;
    private running;
    private lastRunDay;
    constructor(connection: TransactionalConnection);
    start(): void;
    stop(): void;
    onApplicationShutdown(): void;
    runOnce(): Promise<void>;
    /** 按店铺恢复批次内商品；返回受影响统计 */
    private restoreAll;
}
