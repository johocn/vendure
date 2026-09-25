// 幂等补 pick_batch 交接/复核/异常件列
// （生产 Postgres 与本地 sqlite 都可能关闭 synchronize，必须显式补列）。
// 列名不硬编码：从 TypeORM 元数据取 databaseName，避免 dev(sqlite) / prod(postgres) 命名策略差异。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

import { PickBatch } from '../picking/pick-batch.entity';

@Injectable()
export class PickBatchHandoverColumnMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const meta = this.connection.getMetadata(PickBatch);
            const tableName = meta.tableName; // pick_batch
            const wanted: Array<{ property: string; type: 'timestamp' | 'varchar'; length?: number }> = [
                { property: 'handoverAt', type: 'timestamp' },
                { property: 'handoverTo', type: 'varchar', length: 255 },
                { property: 'reviewedAt', type: 'timestamp' },
                { property: 'exceptionAt', type: 'timestamp' },
                { property: 'exceptionNote', type: 'varchar', length: 1000 },
            ];
            const runner = this.connection.createQueryRunner();
            try {
                for (const w of wanted) {
                    const col = meta.columns.find(c => c.propertyName === w.property);
                    const name = col?.databaseName ?? w.property;
                    if (await runner.hasColumn(tableName, name)) continue;
                    await runner.addColumn(
                        tableName,
                        new TableColumn({ name, type: w.type, length: w.length as any, isNullable: true }),
                    );
                    // eslint-disable-next-line no-console
                    console.log(`[PickBatchHandoverColumnMigration] added ${tableName}.${name}`);
                }
            } finally {
                await runner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，下次启动重试（与既有 migration 一致）
            // eslint-disable-next-line no-console
            console.error('[PickBatchHandoverColumnMigration] failed:', e?.message);
        }
    }
}