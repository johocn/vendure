// §70 营业日历：指定日期休业（2026-10-29）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/** 履约配置加一列休业日期（simple-json 存 text：数组 [{date, note}]） */
export const p14ClosureCalendarSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "closureDates" text;
`;

@Injectable()
export class P14ClosureCalendarMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p14ClosureCalendarSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            console.error('[P14ClosureCalendarMigration] failed:', e?.message);
        }
    }
}
