// 确保 coupon_template 表存在券成本承担相关 2 列（costBearer 承担方 / merchantCostRate 商户承担比例）。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等地补列；
// 每列逐个 hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 add-coupon-marketing-fields.ts 范式。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddCouponCostBearerMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponTemplate');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const columns = [
                    // 成本承担方：PLATFORM（平台，默认）| MERCHANT（商户）| SPLIT（按比例分摊）
                    new TableColumn({ name: 'costBearer', type: 'varchar(16)', default: "'PLATFORM'" }),
                    // SPLIT 下商户承担比例（0-100）；PLATFORM/MERCHANT 由服务层规范化为 0/100
                    new TableColumn({ name: 'merchantCostRate', type: 'integer', default: 0 }),
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
            console.error('[AddCouponCostBearerMigration] failed to ensure columns:', e?.message);
        }
    }
}
