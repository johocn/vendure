// 确保 collection 表存在 icon 自定义字段列（分类图标）。
// Vendure 自定义字段列名规则 = customFields + 首字母大写字段名，例如 icon → customFieldsIcon。
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列；
// 失败仅 console.error，不阻塞启动。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { TableColumn } from 'typeorm';

@Injectable()
export class CollectionIconMigration implements OnApplicationBootstrap {
    constructor(private connection: TransactionalConnection) {}

    async onApplicationBootstrap() {
        const qr = this.connection.rawConnection.createQueryRunner();
        try {
            const tableName = 'collection';
            const COL = 'customFieldsIcon';
            if (!(await qr.hasColumn(tableName, COL))) {
                await qr.addColumn(
                    tableName,
                    new TableColumn({
                        name: COL,
                        type: 'varchar(255)',
                        isNullable: true,
                    }),
                );
                // eslint-disable-next-line no-console
                console.log('[CollectionIconMigration] added collection.customFieldsIcon');
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CollectionIconMigration] failed to ensure columns:', e?.message);
        } finally {
            await qr.release();
        }
    }
}