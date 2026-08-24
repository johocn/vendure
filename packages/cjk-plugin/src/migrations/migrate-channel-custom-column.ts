// 确保 channel 表存在 shopname 列（店铺名 customField）
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class ChannelCustomColumnMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('Channel');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const ensure = async (name: string, type: string, nullable: boolean, defaultVal?: unknown) => {
                    if (!(await queryRunner.hasColumn(tableName, name))) {
                        await queryRunner.addColumn(
                            tableName,
                            new TableColumn({
                                name,
                                type,
                                isNullable: nullable,
                                default: defaultVal,
                            }),
                        );
                    }
                };
                await ensure('shopname', 'varchar(255)', true, undefined);
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[ChannelCustomColumnMigration] failed to ensure columns:', e?.message);
        }
    }
}