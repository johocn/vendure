// P4 履约加固（2026-10-23）：超时赔付回扫窗口可配（生产关闭 synchronize，启动幂等补列）
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p4OpsHardeningSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationWindowHours" integer NOT NULL DEFAULT 24;
`;

@Injectable()
export class P4OpsHardeningMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(p4OpsHardeningSql);
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P4OpsHardeningMigration] failed:', e?.message);
        }
    }
}
