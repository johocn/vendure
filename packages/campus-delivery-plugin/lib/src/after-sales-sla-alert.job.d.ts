import { OnApplicationShutdown } from '@nestjs/common';
import { EventBus, TransactionalConnection } from '@vendure/core';
/**
 * 售后 SLA 自动提醒（§90）：扫描本店 Pending 售后单，
 * 临期（剩余不足渠道阈值）与已超时各提醒一次，24h 内不重复。
 * 经 AfterSalesMerchantNotifyEvent 解耦，未装 notification-plugin 时仅无提醒。
 */
export declare class AfterSalesSlaAlertJob implements OnApplicationShutdown {
    private connection;
    private eventBus;
    private fallback;
    constructor(connection: TransactionalConnection, eventBus: EventBus);
    start(): void;
    stop(): void;
    onApplicationShutdown(): void;
    runOnce(): Promise<void>;
}
