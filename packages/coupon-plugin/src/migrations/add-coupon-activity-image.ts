// 确保 coupon_template 表存在活动照片列 activityImage。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等地补列；
// hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 AddCouponMarketingFieldsMigration 范式。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddCouponActivityImageMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponTemplate');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const column = new TableColumn({
                    name: 'activityImage',
                    type: 'varchar(1024)',
                    isNullable: true,
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
            console.error('[AddCouponActivityImageMigration] failed to ensure column:', e?.message);
        }
    }
}
