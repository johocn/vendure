import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { MerchantAdminService } from './merchant-admin.service';
/**
 * 售后自动分流（§98）：按渠道执行 campus_after_sales_auto_rule，
 * 命中规则的待处理售后单自动同意 / 驳回 / 转平台仲裁。
 * - 只处理近 7 日未分流过的 Pending 单（服务层写 autoRuleAppliedAt 防重复）。
 * - 渠道级咨询锁：多实例部署同一渠道只有一个进程执行，避免重复退款。
 */
export declare class AfterSalesAutoRuleJob implements OnApplicationShutdown {
    private connection;
    private merchant;
    private fallback;
    constructor(connection: TransactionalConnection, merchant: MerchantAdminService);
    start(): void;
    stop(): void;
    onApplicationShutdown(): void;
    run(): Promise<void>;
    private runChannelWithLock;
}
