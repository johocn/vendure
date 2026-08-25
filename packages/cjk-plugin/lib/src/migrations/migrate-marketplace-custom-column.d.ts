import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/**
 * 幂等补列：为 Product 新增 marketplace 审批列、Channel 新增 merchantStatus 列。
 * 生产关闭 synchronize 时用 queryRunner 幂等补列，失败仅打日志不阻塞启动。
 */
export declare class MarketplaceCustomColumnMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    private readonly productColumns;
    private readonly channelColumn;
    onApplicationBootstrap(): Promise<void>;
}
