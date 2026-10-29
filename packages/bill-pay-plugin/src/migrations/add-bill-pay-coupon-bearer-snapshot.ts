// 确保 bill_pay_order 表存在券成本承担口径快照列 couponBearer / couponCostRate。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等补列；
// hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 add-bill-pay-coupon-columns.ts 范式。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddBillPayCouponBearerSnapshotMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('BillPayOrder');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                if (!(await queryRunner.hasTable(tableName))) {
                    return;
                }
                const columns = [
                    // 券成本承担方快照：PLATFORM | MERCHANT | SPLIT
                    new TableColumn({ name: 'couponBearer', type: 'varchar(16)', isNullable: true }),
                    // 券成本分摊比例快照（0-100）
                    new TableColumn({ name: 'couponCostRate', type: 'int', isNullable: true }),
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
            console.error('[AddBillPayCouponBearerSnapshotMigration] failed to ensure columns:', e?.message);
        }
    }
}
