import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { MerchantAdminService } from './merchant-admin.service';
/**
 * 售后自动分配（§96）：扫描开启自动分配的渠道，把未指派的未完结售后单
 * 派给当前未完结量最少的本店管理员（具体规则见 MerchantAdminService.afterSalesAutoAssign）。
 * - 分配给谁由服务层保证：同一单只会落一个处理人（指派表按 requestId 唯一）。
 * - 单个渠道失败只告警，不影响其他渠道。
 */
export declare class AfterSalesAutoAssignJob implements OnApplicationShutdown {
    private connection;
    private merchant;
    private fallback;
    constructor(connection: TransactionalConnection, merchant: MerchantAdminService);
    start(): void;
    stop(): void;
    onApplicationShutdown(): void;
    run(): Promise<void>;
}
