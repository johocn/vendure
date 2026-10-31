import { OnApplicationShutdown } from '@nestjs/common';
import { EventBus, TransactionalConnection } from '@vendure/core';
/**
 * 顾客回访到期提醒（§95）：扫描 campus_after_sales_followup 中 nextAt 已到、
 * 且该售后单之后没有更新回访记录的条目，一次性标记 remindedAt 并经事件提醒商家。
 * - 以「最新一条回访」为准：商家补录了新回访（nextAt 改期）后，旧计划自动失效。
 * - 提醒写入失败的风险由幂等标记兜底：每轮最多提醒一次，避免同一计划反复刷屏。
 */
export declare class AfterSalesFollowUpRemindJob implements OnApplicationShutdown {
    private connection;
    private eventBus;
    private fallback;
    constructor(connection: TransactionalConnection, eventBus: EventBus);
    start(): void;
    stop(): void;
    onApplicationShutdown(): void;
    runOnce(): Promise<void>;
    /** 校园时区（UTC+8）展示：MM-DD HH:mm */
    private formatDue;
    /** 兼容不同驱动的返回结构：部分驱动把结果再包一层数组 */
    private rows;
}
