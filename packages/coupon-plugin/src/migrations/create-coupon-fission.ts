// 幂等建 FR-C/FR-E1 留痕表：coupon_fission_record（同人同活动唯一索引）/ coupon_grant_batch。
// 生产 PostgreSQL 与本地 SQLite 都可能关闭 synchronize，参照 CreateCouponSaleMigration 范式。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, Table, TableIndex } from 'typeorm';

@Injectable()
export class CreateCouponFissionMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                const fissionTable = 'coupon_fission_record';
                if (!(await queryRunner.hasTable(fissionTable))) {
                    await queryRunner.createTable(
                        new Table({
                            name: fissionTable,
                            columns: [
                                { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                                { name: 'createdAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                                { name: 'updatedAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                                { name: 'channelId', type: 'int', isNullable: false },
                                { name: 'inviterCustomerId', type: 'int', isNullable: false },
                                { name: 'inviteeCustomerId', type: 'int', isNullable: false },
                                { name: 'inviteeCouponId', type: 'int', isNullable: true },
                                { name: 'inviterCouponId', type: 'int', isNullable: true },
                                { name: 'status', type: 'varchar', isNullable: false, default: "'OK'" },
                                { name: 'sharedAt', type: 'datetime', isNullable: true },
                            ],
                            indices: [
                                new TableIndex({
                                    name: 'IDX_coupon_fission_record_channel_invitee',
                                    columnNames: ['channelId', 'inviteeCustomerId'],
                                    isUnique: true,
                                }),
                            ],
                        }),
                    );
                } else {
                    // 表已存在但唯一索引可能缺失（历史环境），幂等补建
                    const tableMeta = await queryRunner.getTable(fissionTable);
                    const hasIndex =
                        tableMeta?.indices?.some(
                            i => i.name === 'IDX_coupon_fission_record_channel_invitee',
                        ) ?? false;
                    if (!hasIndex) {
                        await queryRunner.createIndex(
                            fissionTable,
                            new TableIndex({
                                name: 'IDX_coupon_fission_record_channel_invitee',
                                columnNames: ['channelId', 'inviteeCustomerId'],
                                isUnique: true,
                            }),
                        );
                    }
                }

                const batchTable = 'coupon_grant_batch';
                if (!(await queryRunner.hasTable(batchTable))) {
                    await queryRunner.createTable(
                        new Table({
                            name: batchTable,
                            columns: [
                                { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                                { name: 'createdAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                                { name: 'updatedAt', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
                                { name: 'channelId', type: 'int', isNullable: false },
                                { name: 'templateId', type: 'int', isNullable: false },
                                { name: 'days', type: 'int', isNullable: false, default: 90 },
                                { name: 'totalSelected', type: 'int', isNullable: false, default: 0 },
                                { name: 'issuedCount', type: 'int', isNullable: false, default: 0 },
                                { name: 'skippedCount', type: 'int', isNullable: false, default: 0 },
                                { name: 'resultsJson', type: 'text', isNullable: true },
                                { name: 'operator', type: 'varchar', isNullable: true },
                                { name: 'notified', type: 'boolean', isNullable: false, default: false },
                            ],
                        }),
                    );
                }
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCouponFissionMigration] failed to ensure tables:', e?.message);
        }
    }
}
