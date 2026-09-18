// 确保 coupon_template 表存在券领取/核销相关 5 列（生产 PostgreSQL 与本地开发 SQLite
// 都可能关闭 synchronize，故此 migration 幂等地补列；每列逐个 hasColumn 判断后 addColumn，
// 出错只打日志不抛错，不阻塞启动，等待下次启动重试）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddCouponFieldsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('CouponTemplate');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const columns = [
                    // 详情页领券入口开关（binding.enabled && claimable 才展示领券入口）
                    new TableColumn({ name: 'claimable', type: 'boolean', isNullable: false, default: true }),
                    // 兑换码（非空=支持凭码兑换；同租户内唯一由 service 层保证）
                    new TableColumn({ name: 'claimCode', type: 'varchar(255)', isNullable: true }),
                    // 领取后 N 天有效（空=走固定 startsAt/endsAt）
                    new TableColumn({ name: 'validDays', type: 'integer', isNullable: true }),
                    // 仅限新客（本租户无历史有效订单）可领可用
                    new TableColumn({ name: 'newCustomerOnly', type: 'boolean', isNullable: false, default: false }),
                    // 会员等级限定（预留，本期只建字段不开发逻辑）
                    new TableColumn({ name: 'memberLevel', type: 'varchar(255)', isNullable: true }),
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
            console.error('[AddCouponFieldsMigration] failed to ensure columns:', e?.message);
        }
    }
}
