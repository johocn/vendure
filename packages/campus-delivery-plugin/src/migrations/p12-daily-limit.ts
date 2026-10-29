// §68 菜品每日限量 / 每人限购（2026-10-29）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/** Product.waimaiDailyLimit / waimaiPerUserLimit → 物理列（TypeORM 对 customFields 转小写） */
export const p12DailyLimitSql = `
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaidailylimit" int;
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaiperuserlimit" int;
`;

@Injectable()
export class P12DailyLimitMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p12DailyLimitSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P12DailyLimitMigration] failed:', e?.message);
        }
    }
}
