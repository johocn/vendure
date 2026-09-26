// 幂等补 stocktake_task 的 (tenantChannelId, postedStockDocId) 复合索引（D44）。
// 生产 Postgres 与本地 sqlite 都关闭 synchronize，实体上的 @Index 不会自动落地，必须显式建索引。
// 用途：单据中心列表（stockDocList）按 postedStockDocId 反查任务号，无索引会退化为全表扫。
// 表名/列名不硬编码：从 TypeORM 元数据取 tableName 与 databaseName，避免 dev(sqlite)/prod(postgres) 命名策略差异。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

import { StocktakeTask } from '../stocktake/stocktake-task.entity';

@Injectable()
export class StocktakePostedDocIndexMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const meta = this.connection.getMetadata(StocktakeTask);
            const tableName = meta.tableName;
            const colName = (property: string) =>
                meta.columns.find(c => c.propertyName === property)?.databaseName ?? property;
            const tenantCol = colName('tenantChannelId');
            const docCol = colName('postedStockDocId');

            const runner = this.connection.createQueryRunner();
            try {
                await runner.query(
                    `CREATE INDEX IF NOT EXISTS "idx_stocktake_task_posted_doc" ON "${tableName}" ("${tenantCol}", "${docCol}")`,
                );
            } finally {
                await runner.release();
            }
        } catch (e: any) {
            // 建索引失败不阻塞启动，下次启动重试（与既有 migration 一致）
            // eslint-disable-next-line no-console
            console.error('[StocktakePostedDocIndexMigration] failed:', e?.message);
        }
    }
}