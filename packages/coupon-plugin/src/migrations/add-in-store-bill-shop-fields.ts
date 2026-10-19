// 到店买单流水补门店字段（T2）：shopId（门店归属，结算分账的商户定位）+ shopName（快照）。
// 幂等逐列 hasColumn 判断后执行；失败只打日志不抛错，不阻塞启动，等待下次启动重试。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddInStoreBillShopFieldsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const tableName = this.connection.getMetadata('InStoreBill').tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const plan: TableColumn[] = [
                    new TableColumn({ name: 'shopId', type: 'integer', isNullable: true }),
                    new TableColumn({ name: 'shopName', type: 'varchar', isNullable: true }),
                ];
                for (const col of plan) {
                    if (!(await queryRunner.hasColumn(tableName, col.name))) {
                        await queryRunner.addColumn(tableName, col);
                    }
                }
                // 门店维度汇总查询（分账对账）索引（幂等）
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_in_store_bill_shop ON "${tableName}" ("shopId")`,
                );
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[AddInStoreBillShopFieldsMigration] failed to ensure columns:', e?.message);
        }
    }
}
