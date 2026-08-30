// 确保 shipping_profile 表存在 requiresAddress / requiresContact 两开关列
// （物流档案=true / 需联系方式档案=true）。
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列。
// 幂等由 IF NOT EXISTS 保证。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class ShippingContactFlagMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(
                    'ALTER TABLE "shipping_profile" ADD COLUMN IF NOT EXISTS "requiresAddress" boolean NOT NULL DEFAULT true;',
                );
                await queryRunner.query(
                    'ALTER TABLE "shipping_profile" ADD COLUMN IF NOT EXISTS "requiresContact" boolean NOT NULL DEFAULT false;',
                );
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[ShippingContactFlagMigration] failed to ensure columns:', e?.message);
        }
    }
}