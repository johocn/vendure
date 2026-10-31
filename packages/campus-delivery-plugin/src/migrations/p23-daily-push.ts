// §86 每日日报推送（2026-10-31）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
// 列名遵循 Vendure 自定义字段规则：customFields + 首字母大写、其余小写（与 p13 一致）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p23DailyPushSql = `
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaidailypushenabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaidailypushtime" varchar(5);
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaidailypushlastdate" varchar(10);
`;

@Injectable()
export class P23DailyPushMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p23DailyPushSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            console.error('[P23DailyPushMigration] failed:', e?.message);
        }
    }
}
