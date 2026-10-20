// 幂等建 FR-F1 每日领券留痕表：coupon_daily_claim_record（同渠道同人同券同业务日唯一索引）。
// 生产 PostgreSQL 与本地 SQLite 都可能关闭 synchronize，参照 CreateCouponFissionMigration 范式。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, Table, TableIndex } from 'typeorm';

const TABLE = 'coupon_daily_claim_record';
const INDEX = 'IDX_coupon_daily_claim_channel_customer_template_date';

@Injectable()
export class CreateCouponFrFMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                if (!(await queryRunner.hasTable(TABLE))) {
                    await queryRunner.createTable(
                        new Table({
                            name: TABLE,
                            columns: [
                                { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                                { name: 'createdAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                                { name: 'updatedAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                                { name: 'channelId', type: 'int', isNullable: false },
                                { name: 'customerId', type: 'int', isNullable: false },
                                { name: 'templateId', type: 'int', isNullable: false },
                                { name: 'claimDate', type: 'varchar', isNullable: false, length: '10' },
                                { name: 'couponId', type: 'int', isNullable: true },
                            ],
                            indices: [
                                new TableIndex({
                                    name: INDEX,
                                    columnNames: ['channelId', 'customerId', 'templateId', 'claimDate'],
                                    isUnique: true,
                                }),
                            ],
                        }),
                    );
                } else {
                    // 表已存在但唯一索引可能缺失（历史环境），幂等补建
                    const tableMeta = await queryRunner.getTable(TABLE);
                    const hasIndex = tableMeta?.indices?.some(i => i.name === INDEX) ?? false;
                    if (!hasIndex) {
                        await queryRunner.createIndex(
                            TABLE,
                            new TableIndex({
                                name: INDEX,
                                columnNames: ['channelId', 'customerId', 'templateId', 'claimDate'],
                                isUnique: true,
                            }),
                        );
                    }
                }
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponFrFMigration] failed to ensure table:', e?.message);
        }
    }
}
