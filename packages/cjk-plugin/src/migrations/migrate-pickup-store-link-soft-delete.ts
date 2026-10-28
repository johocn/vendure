// 幂等补充 pickup_location 的门店关联与软删列：
// - merchantStoreId：关联 merchant-plugin 的 merchant_store（历史数据由 create-merchant-tables 按 type=store 回填）
// - deletedAt：软删时间，删除仅置该字段，避免历史订单/配送档案引用失效
// 生产库 DB_SYNC=0，因此列必须由本迁移补齐；失败不阻塞启动，下次启动重试。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class PickupStoreLinkSoftDeleteMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        const queryRunner = this.connection.createQueryRunner();
        try {
            if (!(await queryRunner.hasTable('pickup_location'))) {
                return;
            }
            const Q = (name: string) => this.connection.driver.escape(name);
            const driver = (this.connection.options as any).type as string;
            const isPostgres = driver === 'postgres' || driver === 'postgresql';
            const timestamp = isPostgres ? 'timestamptz' : 'datetime';

            if (!(await queryRunner.hasColumn('pickup_location', 'merchantStoreId'))) {
                await queryRunner.query(
                    `ALTER TABLE ${Q('pickup_location')} ADD COLUMN ${Q('merchantStoreId')} integer NULL`,
                );
                // eslint-disable-next-line no-console
                console.log('[PickupStoreLinkSoftDeleteMigration] added pickup_location.merchantStoreId');
            }
            if (!(await queryRunner.hasColumn('pickup_location', 'deletedAt'))) {
                await queryRunner.query(
                    `ALTER TABLE ${Q('pickup_location')} ADD COLUMN ${Q('deletedAt')} ${timestamp} NULL`,
                );
                // eslint-disable-next-line no-console
                console.log('[PickupStoreLinkSoftDeleteMigration] added pickup_location.deletedAt');
            }

            // SQLite/Postgres 支持 IF NOT EXISTS；MySQL/MariaDB 不支持，重复创建交由异常吞掉
            const ifNotExists = isPostgres || driver === 'sqlite' || driver === 'better-sqlite3' || driver === 'sqljs';
            try {
                await queryRunner.query(
                    `CREATE INDEX ${ifNotExists ? 'IF NOT EXISTS ' : ''}${Q('idx_pickup_location_merchantStoreId')} ` +
                        `ON ${Q('pickup_location')} (${Q('merchantStoreId')})`,
                );
            } catch {
                // 索引已存在时忽略
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[PickupStoreLinkSoftDeleteMigration] failed to ensure columns:', e?.message);
        } finally {
            await queryRunner.release();
        }
    }
}
