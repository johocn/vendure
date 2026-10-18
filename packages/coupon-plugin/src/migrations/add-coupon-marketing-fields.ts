// 确保 coupon_template 表存在营销展示相关 2 列（anchorPrice 划线锚定价 / label 营销标签）。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等地补列；
// 每列逐个 hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 AddCouponFieldsMigration 范式。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddCouponMarketingFieldsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponTemplate');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const columns = [
                    // 营销划线锚定价（分，展示为划线「原价」对比）；null/0 = 不展示
                    new TableColumn({ name: 'anchorPrice', type: 'integer', isNullable: true }),
                    // 营销标签（如「热卖TOP」，后台可配自由文案）；空 = 不展示
                    new TableColumn({ name: 'label', type: 'varchar(255)', isNullable: true }),
                ];
                for (const column of columns) {
                    if (!(await queryRunner.hasColumn(tableName, column.name))) {
                        await queryRunner.addColumn(tableName, column);
                    }
                }
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddCouponMarketingFieldsMigration] failed to ensure columns:', e?.message);
        }
    }
}
