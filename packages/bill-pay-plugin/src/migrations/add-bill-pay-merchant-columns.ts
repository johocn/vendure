// 确保 bill_pay_order / merchant_agreement / bill_pay_settlement 存在 merchantId 关联列。
// 生产 PostgreSQL 与本地开发 SQLite 都可能关闭 synchronize，故此 migration 幂等补列；
// hasColumn 判断后 addColumn，出错只打日志不抛错，不阻塞启动，等待下次启动重试。
// 参照 add-bill-pay-coupon-columns.ts 范式。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

const TARGETS: Array<{ entity: string; table: string }> = [
    { entity: 'BillPayOrder', table: 'bill_pay_order' },
    { entity: 'MerchantAgreement', table: 'merchant_agreement' },
    { entity: 'BillPaySettlement', table: 'bill_pay_settlement' },
];

@Injectable()
export class AddBillPayMerchantColumnsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        for (const target of TARGETS) {
            try {
                const queryRunner = this.connection.createQueryRunner();
                try {
                    const tableName = this.connection.getMetadata(target.entity)?.tableName ?? target.table;
                    if (!(await queryRunner.hasTable(tableName))) {
                        continue;
                    }
                    if (!(await queryRunner.hasColumn(tableName, 'merchantId'))) {
                        await queryRunner.addColumn(
                            tableName,
                            new TableColumn({ name: 'merchantId', type: 'int', isNullable: true }),
                        );
                    }
                } finally {
                    await queryRunner.release();
                }
            } catch (e: any) {
                // 补列失败不阻塞启动，等待下次启动重试
                // eslint-disable-next-line no-console
                console.error(
                    `[AddBillPayMerchantColumnsMigration] failed to ensure ${target.table}.merchantId:`,
                    e?.message,
                );
            }
        }
    }
}
