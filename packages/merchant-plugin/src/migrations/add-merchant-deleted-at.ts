// 幂等补充 merchant.deletedAt 软删列（与 merchant_store.deletedAt 语义一致）：
// 商户删除只置该字段，避免历史门店/认领/券等引用失效。
// 生产库 DB_SYNC=0，因此列必须由本迁移补齐；失败不阻塞启动，下次启动重试。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class AddMerchantDeletedAtMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        const queryRunner = this.connection.createQueryRunner();
        try {
            if (!(await queryRunner.hasTable('merchant'))) {
                return;
            }
            if (await queryRunner.hasColumn('merchant', 'deletedAt')) {
                return;
            }
            const Q = (name: string) => this.connection.driver.escape(name);
            const driver = (this.connection.options as any).type as string;
            const isPostgres = driver === 'postgres' || driver === 'postgresql';
            const timestamp = isPostgres ? 'timestamptz' : 'datetime';
            await queryRunner.query(
                `ALTER TABLE ${Q('merchant')} ADD COLUMN ${Q('deletedAt')} ${timestamp} NULL`,
            );
            // eslint-disable-next-line no-console
            console.log('[AddMerchantDeletedAtMigration] added merchant.deletedAt');
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[AddMerchantDeletedAtMigration] failed to ensure column:', e?.message);
        } finally {
            await queryRunner.release();
        }
    }
}
