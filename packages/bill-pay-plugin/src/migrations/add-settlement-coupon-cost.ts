// 确保 bill_pay_settlement 表存在券成本承担相关 5 列。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等补列；
// 每列逐个 hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 add-bill-pay-merchant-columns.ts 范式。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddSettlementCouponCostMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const tableName =
                this.connection.getMetadata('BillPaySettlement')?.tableName ?? 'bill_pay_settlement';
            const queryRunner = this.connection.createQueryRunner();
            try {
                if (!(await queryRunner.hasTable(tableName))) {
                    return;
                }
                const columns = [
                    // 本单实际券抵扣额（分）
                    new TableColumn({ name: 'couponAmount', type: 'integer', default: 0 }),
                    // 券成本承担方快照：PLATFORM | MERCHANT | SPLIT
                    new TableColumn({ name: 'couponBearer', type: 'varchar(16)', default: "'PLATFORM'" }),
                    // 券成本分摊比例快照（0-100）
                    new TableColumn({ name: 'couponCostRate', type: 'integer', default: 0 }),
                    // 商户承担的券成本（从应付商户款扣减）
                    new TableColumn({ name: 'merchantCouponCost', type: 'integer', default: 0 }),
                    // 平台承担的券成本
                    new TableColumn({ name: 'platformCouponCost', type: 'integer', default: 0 }),
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
            console.error('[AddSettlementCouponCostMigration] failed to ensure columns:', e?.message);
        }
    }
}
