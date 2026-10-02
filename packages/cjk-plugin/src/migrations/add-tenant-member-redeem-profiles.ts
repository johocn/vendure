// 确保 tenant_member 表存在 shipping_profile_ids 列（可核销配送档案白名单）
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列。
// 幂等由 IF NOT EXISTS 保证；默认值 '[]' 须带单引号（TypeORM TableColumn 会产出未加引号的 DEFAULT []）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class AddTenantMemberRedeemProfiles implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(
                    `ALTER TABLE "tenant_member" ADD COLUMN IF NOT EXISTS "shipping_profile_ids" text NOT NULL DEFAULT '[]';`,
                );
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddTenantMemberRedeemProfiles] failed to ensure column:', e?.message);
        }
    }
}