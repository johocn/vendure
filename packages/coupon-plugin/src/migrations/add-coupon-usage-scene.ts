// 确保 coupon_template 表存在 usageScene 列（生产 PostgreSQL 与本地开发 SQLite 都可能关闭
// synchronize，故此 migration 幂等补列；出错只打日志不抛错，不阻塞启动，等待下次启动重试）。
// 历史数据默认 'ONLINE'，券行为与改造前完全一致。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddCouponUsageSceneMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponTemplate');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const column = new TableColumn({
                    name: 'usageScene',
                    type: 'varchar(255)',
                    isNullable: false,
                    default: "'ONLINE'",
                });
                if (!(await queryRunner.hasColumn(tableName, column.name))) {
                    await queryRunner.addColumn(tableName, column);
                }
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddCouponUsageSceneMigration] failed to ensure column:', e?.message);
        }
    }
}
