// §95（2026-10-31）：售后 SLA 暂停/恢复 + 回访到期提醒 + 售后月度摘要推送。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p25AfterSalesSlaFollowupMonthlySql = `
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "slaPausedAt" timestamptz;
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "slaPausedMs" bigint NOT NULL DEFAULT 0;
ALTER TABLE campus_after_sales_followup ADD COLUMN IF NOT EXISTS "remindedAt" timestamptz;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesmonthlypushenabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesmonthlypushday" integer;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesmonthlypushtime" varchar(5);
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesmonthlypushlastmonth" varchar(7);
`;

@Injectable()
export class P25AfterSalesSlaFollowupMonthlyMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p25AfterSalesSlaFollowupMonthlySql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P25AfterSalesSlaFollowupMonthlyMigration] failed:', e?.message);
        }
    }
}
