// 确保 coupon_template 表存在 distributionChannels / salePrice 列（生产 PostgreSQL 与本地开发
// SQLite 都可能关闭 synchronize，故此 migration 幂等补列；出错只打日志不抛错，不阻塞启动）。
// distributionChannels 允许为 NULL（历史券走老字段推导）；salePrice 默认 0（不可售）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddCouponDistributionChannelsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponTemplate');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const channels = new TableColumn({
                    name: 'distributionChannels',
                    type: 'varchar(255)',
                    isNullable: true,
                });
                if (!(await queryRunner.hasColumn(tableName, channels.name))) {
                    await queryRunner.addColumn(tableName, channels);
                }
                const salePrice = new TableColumn({
                    name: 'salePrice',
                    type: 'int',
                    isNullable: false,
                    default: '0',
                });
                if (!(await queryRunner.hasColumn(tableName, salePrice.name))) {
                    await queryRunner.addColumn(tableName, salePrice);
                }
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddCouponDistributionChannelsMigration] failed to ensure columns:', e?.message);
        }
    }
}